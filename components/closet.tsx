"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Home,
  Shirt,
  Plus,
  Sparkles,
  Heart,
  ArrowUpRight,
  ArrowLeft,
  Search,
  Camera,
  ImagePlus,
  X,
  Trash2,
  Pencil,
  Check,
  LockKeyhole,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import {
  categories,
  colors,
  occasions,
  generateLooks,
  findSavedLook,
  demoPieces,
  type Piece,
  type Look,
  type ClosetData,
  type Occasion,
} from "@/lib/closet";
import { preparePhoto, readLegacyData } from "@/lib/storage";
import {
  loadCloset,
  savePiece,
  deletePiece,
  saveLook,
  updateFavorite,
  deleteLook,
  importLegacyCloset,
  getSupabase,
} from "@/lib/supabase";
import Garment from "./garment";
type Tab = "home" | "wardrobe" | "add" | "generate" | "looks";
const tabs = [
  { id: "home", label: "Início", icon: Home },
  { id: "wardrobe", label: "Guarda-roupa", icon: Shirt },
  { id: "add", label: "Adicionar", icon: Plus },
  { id: "generate", label: "Montar look", icon: Sparkles },
  { id: "looks", label: "Meus looks", icon: Heart },
] as const;
const emptyPiece = (): Piece => ({
  id: crypto.randomUUID(),
  name: "",
  category: "Blusas",
  color: "Branco",
  occasions: ["Casual"],
});
export default function Closet({
  mode,
  userId,
  onSignOut,
  onLeaveDemo,
}: {
  mode: "personal" | "demo";
  userId?: string;
  onSignOut?: () => Promise<void>;
  onLeaveDemo?: () => void;
}) {
  const [data, setData] = useState<ClosetData | null>(() =>
    mode === "demo" ? { version: 1, pieces: demoPieces, looks: [] } : null,
  );
  const [tab, setTab] = useState<Tab>("home");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [color, setColor] = useState("Todas");
  const [selected, setSelected] = useState<Piece | null>(null);
  const [draft, setDraft] = useState<Piece | null>(null);
  const [occasion, setOccasion] = useState<Occasion>("Casual");
  const [generated, setGenerated] = useState<Look[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mutationLock = useRef(false);
  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    draftIdRef.current = draft?.id ?? null;
  }, [draft]);
  useEffect(() => {
    if (mode === "demo") return;
    if (!userId) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState === "visible")
        loadCloset(userId)
          .then((next) => {
            if (active) setData(next);
          })
          .catch(() => {
            if (active)
              setError(
                "Não foi possível atualizar seu closet. Confira a conexão e tente novamente.",
              );
          });
    };
    refresh();
    readLegacyData()
      .then((legacy) => {
        if (active)
          setLegacyCount(legacy?.pieces.filter((p) => !p.demo).length ?? 0);
      })
      .catch(() => {});
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 8 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      active = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mode, userId]);
  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selected]);
  function navigate(next: Tab) {
    setTab(next);
    setNotice("");
    setError("");
    if (next === "add" && mode === "demo") {
      setNotice(
        "O cadastro de peças está disponível na sua conta pessoal. Entre ou crie uma conta para continuar.",
      );
      return;
    }
    if (next === "add") {
      setDraft(emptyPiece());
      setCandidateImage(null);
    }
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  async function runMutation(
    action: () => Promise<{ cleanupWarning?: boolean } | void>,
    message: string,
  ): Promise<boolean> {
    if (mutationLock.current || mode !== "personal" || !userId) return false;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      try {
        setData(await loadCloset(userId));
      } catch {
        setError(
          "Alteração aplicada, mas não foi possível atualizar a tela. Recarregue a página.",
        );
        return false;
      }
      setNotice(
        message +
          (result?.cleanupWarning
            ? " A foto antiga não pôde ser removida do Storage; verifique os arquivos órfãos."
            : ""),
      );
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível concluir: ${cause.message}`
          : "Não foi possível concluir. Tente novamente.",
      );
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !draft ||
      !data ||
      !userId ||
      !draft.name.trim() ||
      !draft.occasions.length ||
      mode !== "personal"
    )
      return;
    const piece = {
      ...draft,
      name: draft.name.trim(),
      style: draft.style?.trim() ?? "",
    };
    const original = data.pieces.find((p) => p.id === piece.id);
    if (
      await runMutation(
        () => savePiece(piece, userId, original),
        "Peça salva no seu guarda-roupa.",
      )
    ) {
      setDraft(null);
      setCandidateImage(null);
      setTab("wardrobe");
    }
  }
  async function photo(file?: File) {
    if (!file || !draft) return;
    const targetId = draft.id;
    setPhotoBusy(true);
    setError("");
    try {
      const image = await preparePhoto(file);
      setCandidateImage(null);
      setDraft((prev) =>
        prev?.id === targetId
          ? {
              ...prev,
              image,
              enhancedImage: undefined,
              enhancedPhotoPath: undefined,
            }
          : prev,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar a foto.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  async function generateCatalogImage() {
    if (!draft?.photoPath || mode !== "personal" || aiBusy || busy) return;
    const targetId = draft.id;
    setAiBusy(true);
    setCandidateImage(null);
    setError("");
    setNotice("");
    try {
      const { data: sessionData, error: sessionError } =
        await getSupabase().auth.getSession();
      if (sessionError || !sessionData.session?.access_token)
        throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/catalog-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pieceId: targetId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Não foi possível gerar a imagem.");
      if (
        typeof result.image !== "string" ||
        !result.image.startsWith("data:image/jpeg;base64,")
      )
        throw new Error("A imagem recebida é inválida.");
      if (draftIdRef.current === targetId) setCandidateImage(result.image);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a imagem.",
      );
    } finally {
      setAiBusy(false);
    }
  }
  async function generate() {
    if (!data) return;
    const looks: Look[] = generateLooks(data.pieces, occasion).map(
      (pieceIds, i) => ({
        id: crypto.randomUUID(),
        pieceIds,
        occasion,
        favorite: false,
        createdAt: new Date(Date.now() + i).toISOString(),
      }),
    );
    if (!looks.length) {
      setGenerated([]);
      setNotice(
        "Para esta ocasião, cadastre uma blusa e uma calça ou saia (ou um vestido), além de um calçado.",
      );
      return;
    }
    if (mode === "demo") {
      setData({ ...data, looks: [...looks, ...data.looks] });
      setGenerated(looks);
      setNotice("Looks fictícios criados apenas para esta demonstração.");
      return;
    }
    if (!userId || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const saved: Look[] = [];
    try {
      for (const look of looks) {
        await saveLook(look, userId);
        saved.push(look);
      }
      setGenerated(saved);
      setNotice(
        `${saved.length} ${saved.length === 1 ? "combinação salva" : "combinações salvas"} no seu histórico.`,
      );
    } catch (cause) {
      setGenerated(saved);
      setError(
        `${saved.length} combinação(ões) foram salvas. A próxima falhou: ${cause instanceof Error ? cause.message : "tente novamente."}`,
      );
    } finally {
      try {
        setData(await loadCloset(userId));
      } catch {
        setError(
          "Não foi possível atualizar a tela. Recarregue a página para consultar seus looks.",
        );
      }
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function favorite(look: Look) {
    if (!data) return;
    const exists = data.looks.some((l) => l.id === look.id);
    const updated = {
      ...look,
      id: mode === "personal" && !exists ? crypto.randomUUID() : look.id,
      favorite: !look.favorite,
    };
    if (mode === "demo") {
      setData({
        ...data,
        looks: exists
          ? data.looks.map((l) => (l.id === look.id ? updated : l))
          : [updated, ...data.looks],
      });
      return;
    }
    if (!userId) return;
    await runMutation(
      () =>
        exists
          ? updateFavorite(look.id, updated.favorite, userId)
          : saveLook(updated, userId),
      updated.favorite
        ? "Look salvo nos favoritos."
        : "Look removido dos favoritos.",
    );
  }
  async function removeLook(look: Look) {
    if (!data) return;
    if (mode === "demo") {
      setData({ ...data, looks: data.looks.filter((l) => l.id !== look.id) });
      return;
    }
    if (userId)
      await runMutation(() => deleteLook(look.id, userId), "Look excluído.");
  }
  async function importOldCloset() {
    if (!userId || mode !== "personal" || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const legacy = await readLegacyData();
      if (!legacy) {
        setNotice("Nenhum catálogo da V1 foi encontrado neste navegador.");
        return;
      }
      const imported = await importLegacyCloset(legacy, userId);
      setNotice(
        `${imported.pieces} peça(s) e ${imported.looks} look(s) importados. Os dados locais da V1 continuam intactos.`,
      );
    } catch (cause) {
      setError(
        `Importação interrompida: ${cause instanceof Error ? cause.message : "tente novamente."} Os itens já importados permanecem na conta; você pode tentar novamente. Os dados locais continuam intactos.`,
      );
    } finally {
      try {
        setData(await loadCloset(userId));
      } catch {
        setError("Não foi possível atualizar a tela. Recarregue a página.");
      }
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function removeSelectedPiece() {
    if (
      !data ||
      !selected ||
      mode !== "personal" ||
      !userId ||
      !window.confirm(
        "Excluir esta peça? Os looks que a utilizam também serão removidos.",
      )
    )
      return;
    if (
      await runMutation(
        () => deletePiece(selected, userId),
        "Peça e looks relacionados excluídos.",
      )
    ) {
      setSelected(null);
      setGenerated([]);
    }
  }
  function lookCard(look: Look, index: number) {
    if (!data) return null;
    const current = findSavedLook(data.looks, look) ?? look;
    const pieces = look.pieceIds
      .map((id) => data.pieces.find((p) => p.id === id))
      .filter((p): p is Piece => !!p);
    if (pieces.length !== look.pieceIds.length) return null;
    return (
      <article className="look-card" key={look.id}>
        <div className="look-collage">
          {pieces.map((p) => (
            <div key={p.id}>
              <Garment piece={p} />
            </div>
          ))}
          <button
            className={`heart-button ${current.favorite ? "active" : ""}`}
            aria-label={
              current.favorite
                ? "Remover dos favoritos"
                : "Salvar look como favorito"
            }
            aria-pressed={current.favorite}
            disabled={busy}
            onClick={() => favorite(current)}
          >
            <Heart
              size={19}
              fill={current.favorite ? "currentColor" : "none"}
            />
          </button>
        </div>
        <div className="look-caption">
          <div>
            <span className="eyebrow">{look.occasion}</span>
            <h3>
              {
                ["Essencial e leve", "Um toque de você", "Pronto para sair"][
                  index % 3
                ]
              }
            </h3>
          </div>
          <span className="piece-count">{pieces.length} peças</span>
        </div>
        <p className="look-items">{pieces.map((p) => p.name).join(" + ")}</p>
      </article>
    );
  }
  const suggestions = data
    ? generateLooks(data.pieces, "Casual").map((pieceIds, i) => ({
        id: `suggestion-${i}-${pieceIds.join("-")}`,
        pieceIds,
        occasion: "Casual" as const,
        favorite: false,
        createdAt: new Date().toISOString(),
      }))
    : [];
  const filtered =
    data?.pieces.filter(
      (p) =>
        (category === "Todas" || p.category === category) &&
        (color === "Todas" || p.color === color) &&
        p.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(
            query
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ),
    ) ?? [];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <Link
          href="/"
          className="brand"
          aria-label="Meu Closet AI, início"
          onClick={() => navigate("home")}
        >
          <span className="brand-icon">
            <Shirt size={23} />
          </span>
          <span>
            meu closet<span className="brand-ai">AI</span>
          </span>
        </Link>
        <span className="top-note">MENOS DÚVIDAS. MAIS VOCÊ.</span>
        <button
          className="top-action"
          onClick={async () => {
            if (mode === "demo") onLeaveDemo?.();
            else
              try {
                await onSignOut?.();
              } catch {
                setError("Não foi possível sair. Tente novamente.");
              }
          }}
        >
          {mode === "demo" ? "Entrar" : "Sair"}
        </button>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className="mode-banner">
          <LockKeyhole size={14} />
          <span>
            {mode === "demo"
              ? "Modo demonstração: peças fictícias, sem dados pessoais e sem salvamento."
              : "Closet pessoal: peças e fotos privadas na sua conta Supabase."}
          </span>
          {mode === "demo" && (
            <button onClick={onLeaveDemo}>Criar minha conta</button>
          )}
        </div>
        {mode === "personal" && legacyCount > 0 && (
          <div className="legacy-banner">
            <span>
              Encontramos {legacyCount} peça(s) da V1 neste navegador. A
              importação é opcional e não apaga os dados locais.
            </span>
            <button
              className="button secondary"
              disabled={busy}
              onClick={importOldCloset}
            >
              {busy ? "Importando…" : "Importar da V1"}
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="alert">
            {notice}
          </div>
        )}
        {!data ? (
          <div className="empty">
            <LoaderCircle className="spinner" />
            <h1>Preparando seu closet</h1>
            <p>
              {error
                ? "Recarregue a página para tentar novamente."
                : "Um instante para encontrar suas peças."}
            </p>
          </div>
        ) : (
          <>
            {tab === "home" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">BOAS-VINDAS AO SEU CLOSET</span>
                    <h1 ref={titleRef} tabIndex={-1}>
                      Seu estilo. <em>Suas possibilidades.</em>
                    </h1>
                    <p>
                      Redescubra o que você já tem. Vista o que faz você se
                      sentir bem.
                    </p>
                  </div>
                  <button
                    className="button desktop-add"
                    onClick={() => navigate("add")}
                  >
                    <Plus size={17} /> Adicionar peça
                  </button>
                </section>
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-tag">
                      <Sparkles size={14} /> INSPIRAÇÃO QUE COMEÇA NO SEU CLOSET
                    </span>
                    <h2>
                      Um closet organizado.
                      <br />
                      <em>Mil novas versões de você.</em>
                    </h2>
                    <p>
                      Suas peças favoritas, em combinações que você ainda não
                      imaginou.
                    </p>
                    <button
                      className="button"
                      onClick={() => navigate("generate")}
                    >
                      Descobrir meu próximo look <ArrowUpRight size={17} />
                    </button>
                    <span className="hero-foot">
                      Feito com as peças que você já tem.
                    </span>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <span className="art-circle" />
                    {data.pieces.length ? (
                      (["Blusas", "Calças", "Acessórios"] as const).map(
                        (category, index) => {
                          const piece =
                            data.pieces.find((p) => p.category === category) ??
                            data.pieces[index];
                          return piece ? (
                            <div
                              className={`hero-garment ${["one", "two", "three"][index]}`}
                              key={category}
                            >
                              <Garment piece={piece} />
                            </div>
                          ) : null;
                        },
                      )
                    ) : (
                      <div className="hero-empty">
                        <Shirt size={58} />
                        <span>Seu estilo começa aqui</span>
                      </div>
                    )}
                    <span className="art-caption">
                      CURADORIA DO SEU DIA A DIA
                    </span>
                  </div>
                </section>
                <section className="stats" aria-label="Resumo do closet">
                  {[
                    {
                      value: data.pieces.length,
                      label: "peças no seu closet",
                      icon: Shirt,
                    },
                    {
                      value: new Set(data.pieces.map((p) => p.category)).size,
                      label: "categorias de estilo",
                      icon: Sparkles,
                    },
                    {
                      value: data.looks.filter((l) => l.favorite).length,
                      label: "looks favoritos",
                      icon: Heart,
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <span className="stat-icon">
                        <s.icon size={20} />
                      </span>
                      <div>
                        <strong>{String(s.value).padStart(2, "0")}</strong>
                        <span>{s.label}</span>
                      </div>
                    </div>
                  ))}
                </section>
                <section>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">UM POUCO DE INSPIRAÇÃO</span>
                      <h2>Novas formas de usar suas peças</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("generate")}
                    >
                      Montar um look <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="looks-grid">{suggestions.map(lookCard)}</div>
                  {!suggestions.length && (
                    <div className="empty">
                      <p>
                        Adicione peças para descobrir suas primeiras
                        combinações.
                      </p>
                      <button
                        className="button"
                        onClick={() => navigate("add")}
                      >
                        Adicionar peça
                      </button>
                    </div>
                  )}
                </section>
                <section className="wardrobe-preview">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        CADA PEÇA CONTA UMA HISTÓRIA
                      </span>
                      <h2>Dentro do seu guarda-roupa</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("wardrobe")}
                    >
                      Ver todas <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="pieces-grid preview">
                    {data.pieces.slice(0, 4).map((p) => (
                      <button
                        className="piece-card"
                        key={p.id}
                        onClick={() => setSelected(p)}
                      >
                        <div className="piece-art">
                          <Garment piece={p} />
                        </div>
                        <h3>{p.name}</h3>
                        <p>
                          {p.category} · {p.color}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {tab === "wardrobe" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">SEU ESTILO, EM UM SÓ LUGAR</span>
                    <h1 ref={titleRef} tabIndex={-1}>
                      Meu guarda-roupa
                    </h1>
                    <p>{data.pieces.length} peças e muitas possibilidades.</p>
                  </div>
                  <button className="button" onClick={() => navigate("add")}>
                    <Plus size={17} /> Adicionar peça
                  </button>
                </section>
                <div className="filters">
                  <label className="search">
                    <Search size={18} />
                    <input
                      placeholder="Buscar uma peça..."
                      aria-label="Buscar peça pelo nome"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="color-filter">
                    Cor
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    >
                      <option>Todas</option>
                      {Object.keys(colors).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="chips" aria-label="Filtrar por categoria">
                  {["Todas", ...categories].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "chip active" : "chip"}
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="pieces-grid">
                  {filtered.map((p) => (
                    <button
                      className="piece-card"
                      key={p.id}
                      onClick={() => setSelected(p)}
                    >
                      <div className="piece-art">
                        <Garment piece={p} />
                        {p.demo && <span className="demo-tag">DEMO</span>}
                      </div>
                      <h3>{p.name}</h3>
                      <p>
                        <span
                          className="color-dot"
                          style={{ background: colors[p.color] }}
                        />
                        {p.category} · {p.color}
                      </p>
                    </button>
                  ))}
                </div>
                {!filtered.length && (
                  <div className="empty">
                    <Shirt />
                    <h2>Nenhuma peça por aqui</h2>
                    <p>
                      Experimente outros filtros ou adicione sua primeira peça.
                    </p>
                    <button className="button" onClick={() => navigate("add")}>
                      Adicionar peça
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "add" && draft && (
              <>
                <button
                  className="text-button back"
                  onClick={() => navigate("wardrobe")}
                >
                  <ArrowLeft size={16} /> Voltar ao guarda-roupa
                </button>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">UM CLOSET COM A SUA CARA</span>
                    <h1 ref={titleRef} tabIndex={-1}>
                      {data.pieces.some((p) => p.id === draft.id)
                        ? "Editar peça"
                        : "Adicionar peça"}
                    </h1>
                    <p>Comece com uma foto. O resto é do seu jeito.</p>
                  </div>
                </section>
                <form className="piece-form" onSubmit={submit}>
                  <div>
                    <div className="upload-preview">
                      {draft.image ? (
                        <Garment piece={draft} />
                      ) : (
                        <>
                          <Camera size={34} />
                          <h3>Sua peça merece um lugar aqui</h3>
                          <p>Fotografe em um fundo claro, com boa luz.</p>
                        </>
                      )}
                    </div>
                    <div className="upload-buttons">
                      <label className="button secondary">
                        <Camera size={17} /> Câmera
                        <input
                          disabled={photoBusy}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            void photo(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <label className="button secondary">
                        <ImagePlus size={17} /> Galeria
                        <input
                          disabled={photoBusy}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            void photo(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {photoBusy && <p role="status">Preparando foto…</p>}
                    {draft.image && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            image: undefined,
                            photoPath: undefined,
                            enhancedImage: undefined,
                            enhancedPhotoPath: undefined,
                          })
                        }
                      >
                        Remover foto
                      </button>
                    )}
                    <p className="hint">
                      Foto opcional · até 20 MB. Sem foto, usamos uma
                      ilustração.
                    </p>
                    {draft.image?.startsWith("data:image/") && (
                      <p className="hint">
                        Salve esta foto antes de gerar a versão de catálogo.
                      </p>
                    )}
                    {draft.photoPath &&
                      !draft.image?.startsWith("data:image/") &&
                      mode === "personal" && (
                        <div className="catalog-editor">
                          <span className="eyebrow">ESTÚDIO IA</span>
                          <h3>Versão de catálogo</h3>
                          <p>
                            Gere uma apresentação em fundo claro e confira os
                            detalhes antes de usar. Cada geração pode ter custo.
                            A foto original fica guardada.
                          </p>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={aiBusy || busy || photoBusy}
                            onClick={() => void generateCatalogImage()}
                          >
                            {aiBusy ? (
                              <LoaderCircle size={16} className="spinner" />
                            ) : (
                              <Sparkles size={16} />
                            )}
                            {aiBusy
                              ? "Gerando imagem…"
                              : "Gerar versão de catálogo"}
                          </button>
                          {aiBusy && (
                            <p role="status">
                              A geração pode levar até dois minutos.
                            </p>
                          )}
                          {candidateImage && (
                            <div
                              className="catalog-review"
                              role="group"
                              aria-label="Comparar foto original e versão gerada"
                            >
                              <figure>
                                <div className="catalog-review-art">
                                  <Garment
                                    piece={{
                                      ...draft,
                                      enhancedImage: undefined,
                                    }}
                                  />
                                </div>
                                <figcaption>Original</figcaption>
                              </figure>
                              <figure>
                                <div className="catalog-review-art">
                                  <Garment
                                    piece={{
                                      ...draft,
                                      enhancedImage: candidateImage,
                                    }}
                                  />
                                </div>
                                <figcaption>Gerada por IA</figcaption>
                              </figure>
                              <div className="catalog-review-actions">
                                <button
                                  type="button"
                                  className="button"
                                  onClick={() => {
                                    setDraft({
                                      ...draft,
                                      enhancedImage: candidateImage,
                                      enhancedPhotoPath: undefined,
                                    });
                                    setCandidateImage(null);
                                    setNotice(
                                      "Versão escolhida. Salve a peça para aplicá-la ao guarda-roupa.",
                                    );
                                  }}
                                >
                                  Usar esta versão
                                </button>
                                <button
                                  type="button"
                                  className="button secondary"
                                  onClick={() => setCandidateImage(null)}
                                >
                                  Descartar
                                </button>
                              </div>
                            </div>
                          )}
                          {!candidateImage &&
                            (draft.enhancedImage ||
                              draft.enhancedPhotoPath) && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    enhancedImage: undefined,
                                    enhancedPhotoPath: undefined,
                                  })
                                }
                              >
                                Voltar a exibir a foto original
                              </button>
                            )}
                        </div>
                      )}
                  </div>
                  <div className="form-fields">
                    <label>
                      Nome da peça
                      <input
                        required
                        maxLength={80}
                        placeholder="Ex.: minha camisa de linho"
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </label>
                    <div className="field-row">
                      <label>
                        Categoria
                        <select
                          value={draft.category}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              category: e.target.value as Piece["category"],
                            })
                          }
                        >
                          {categories.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Cor
                        <select
                          value={draft.color}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              color: e.target.value as Piece["color"],
                            })
                          }
                        >
                          {Object.keys(colors).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Estilo (opcional)
                      <input
                        className="style-field"
                        maxLength={80}
                        placeholder="Ex.: minimalista, clássico"
                        value={draft.style ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, style: e.target.value })
                        }
                      />
                    </label>
                    <fieldset>
                      <legend>Em quais ocasiões você usaria?</legend>
                      <div className="occasion-options">
                        {occasions.map((o) => (
                          <label
                            className={`occasion-option ${draft.occasions.includes(o) ? "chosen" : ""}`}
                            key={o}
                          >
                            <input
                              type="checkbox"
                              checked={draft.occasions.includes(o)}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  occasions: e.target.checked
                                    ? [...draft.occasions, o]
                                    : draft.occasions.filter((x) => x !== o),
                                })
                              }
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                      <p className="hint">Selecione pelo menos uma ocasião.</p>
                    </fieldset>
                    <div className="privacy-card">
                      <LockKeyhole size={18} />
                      <p>
                        Fotos e informações são enviadas à sua conta no
                        Supabase. As fotos ficam em um bucket privado e são
                        exibidas por links temporários.
                      </p>
                    </div>
                    <button
                      className="button full"
                      disabled={
                        busy ||
                        photoBusy ||
                        aiBusy ||
                        !draft.occasions.length ||
                        !draft.name.trim()
                      }
                      type="submit"
                    >
                      <Check size={17} />
                      {busy ? "Salvando…" : "Salvar peça"}
                    </button>
                  </div>
                </form>
              </>
            )}
            {tab === "generate" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">
                      REDESCUBRA SUAS POSSIBILIDADES
                    </span>
                    <h1 ref={titleRef} tabIndex={-1}>
                      O que vamos vestir hoje?
                    </h1>
                    <p>
                      Escolha a ocasião. Nós combinamos as peças do seu closet.
                    </p>
                  </div>
                </section>
                <section className="generator-panel">
                  <Sparkles size={28} />
                  <h2>Um convite para experimentar</h2>
                  <label>
                    Qual é a ocasião?
                    <select
                      value={occasion}
                      onChange={(e) => {
                        setOccasion(e.target.value as Occasion);
                        setGenerated([]);
                      }}
                    >
                      {occasions.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <button className="button" disabled={busy} onClick={generate}>
                    <Sparkles size={17} />
                    {busy ? "Montando…" : "Gerar 3 combinações"}
                  </button>
                  <p className="hint">
                    Regras simples, sem IA nesta versão: ocasião, peças
                    essenciais e cores neutras.
                    <br />
                    Até 3 looks únicos, conforme as peças disponíveis.
                  </p>
                </section>
                <div className="looks-grid">{generated.map(lookCard)}</div>
              </>
            )}
            {tab === "looks" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">COMBINAÇÕES PARA GUARDAR</span>
                    <h1 ref={titleRef} tabIndex={-1}>
                      Meus looks
                    </h1>
                    <p>
                      Suas descobertas de estilo, prontas para o próximo dia.
                    </p>
                  </div>
                  <button
                    className="button"
                    onClick={() => navigate("generate")}
                  >
                    <Sparkles size={17} /> Novo look
                  </button>
                </section>
                <div className="chips">
                  <button
                    className={!onlyFavorites ? "chip active" : "chip"}
                    aria-pressed={!onlyFavorites}
                    onClick={() => setOnlyFavorites(false)}
                  >
                    Todos os looks · {data.looks.length}
                  </button>
                  <button
                    className={onlyFavorites ? "chip active" : "chip"}
                    aria-pressed={onlyFavorites}
                    onClick={() => setOnlyFavorites(true)}
                  >
                    Favoritos · {data.looks.filter((l) => l.favorite).length}
                  </button>
                </div>
                <div className="looks-grid">
                  {data.looks
                    .filter((l) => !onlyFavorites || l.favorite)
                    .map((l, i) => (
                      <div key={l.id}>
                        {lookCard(l, i)}
                        <div className="history-footer">
                          <span>
                            {new Date(l.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                          <button
                            disabled={busy}
                            className="text-button"
                            aria-label="Excluir look do histórico"
                            onClick={() => {
                              void removeLook(l);
                            }}
                          >
                            <Trash2 size={15} /> Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
                {!data.looks.filter((l) => !onlyFavorites || l.favorite)
                  .length && (
                  <div className="empty">
                    <Heart />
                    <h2>
                      {onlyFavorites
                        ? "Seus favoritos começam aqui"
                        : "Seu próximo look está esperando"}
                    </h2>
                    <p>
                      {onlyFavorites
                        ? "Toque no coração de uma combinação para guardá-la."
                        : "Monte uma combinação com as peças que você já tem."}
                    </p>
                    <button
                      className="button"
                      onClick={() => navigate("generate")}
                    >
                      Montar meu primeiro look
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        <footer className="page-footer">
          <Shirt size={16} />
          <span>Menos peças esquecidas. Mais histórias para vestir.</span>
          <span>
            Meu Closet AI ·{" "}
            {mode === "demo" ? "Demonstração" : "Closet pessoal"}
          </span>
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        {tabs.map((t) => (
          <button
            disabled={!data}
            key={t.id}
            className={`${tab === t.id ? "selected" : ""} ${t.id === "add" ? "add-nav" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => navigate(t.id)}
          >
            <span>
              <t.icon size={21} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <dialog
        ref={dialogRef}
        className="detail-dialog"
        aria-labelledby="detail-title"
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        {selected && (
          <>
            <button
              className="close-button"
              aria-label="Fechar detalhes"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="detail-art">
              <Garment piece={selected} />
            </div>
            <div className="detail-content">
              {error && (
                <p role="alert" className="alert error">
                  {error}
                </p>
              )}
              <span className="eyebrow">
                {selected.demo ? "PEÇA DE DEMONSTRAÇÃO" : selected.category}
              </span>
              <h2 id="detail-title">{selected.name}</h2>
              <p>
                {selected.category} · {selected.color}
              </p>
              {selected.style && <p>Estilo: {selected.style}</p>}
              <div className="chips">
                {selected.occasions.map((o) => (
                  <span className="chip" key={o}>
                    {o}
                  </span>
                ))}
              </div>
              {mode === "personal" && (
                <button
                  className="button full"
                  disabled={busy}
                  onClick={() => {
                    setDraft({ ...selected });
                    setCandidateImage(null);
                    setSelected(null);
                    setTab("add");
                  }}
                >
                  <Pencil size={16} /> Editar peça
                </button>
              )}
              {mode === "personal" && (
                <button
                  className="delete-button"
                  disabled={busy}
                  onClick={removeSelectedPiece}
                >
                  <Trash2 size={16} /> Excluir peça
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
