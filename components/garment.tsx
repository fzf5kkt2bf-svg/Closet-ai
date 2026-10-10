import Image from "next/image";
import { useId } from "react";
import { colors, type Piece } from "@/lib/closet";
export default function Garment({ piece }: { piece: Piece }) {
  const illustrationId = useId().replace(/:/g, "");
  // Uploaded images remain local; SVG illustrations below are original artwork.
  if (piece.image)
    return (
      <Image
        src={piece.image}
        alt={piece.name}
        className="garment-photo"
        width={200}
        height={220}
        unoptimized
      />
    );
  const fill = colors[piece.color];
  const paths: Record<Piece["category"], string> = {
    Blusas:
      "M69 40 42 54 26 90 51 104 65 82 65 174 135 174 135 82 149 104 174 90 158 54 131 40 Q100 61 69 40Z",
    Casacos:
      "M74 36 45 53 28 169 58 173 70 93 68 183 132 183 130 93 142 173 172 169 155 53 126 36 100 57Z",
    Calças: "M65 38 135 38 146 182 110 182 100 91 90 182 54 182Z",
    Saias: "M72 43 128 43 152 178 Q100 193 48 178Z",
    Vestidos:
      "M78 32 122 32 133 75 118 96 154 185 Q100 197 46 185 L82 96 67 75Z",
    Calçados:
      "M42 113 63 78 94 104 139 120 Q170 120 174 142 L174 154 31 154 Q21 132 42 113Z",
    Acessórios:
      "M56 86 144 86 156 171 Q100 185 44 171Z M76 86 76 62 Q100 29 124 62 L124 86",
  };
  return (
    <svg
      viewBox="0 0 200 220"
      role="img"
      aria-label={piece.name}
      className="garment"
    >
      <defs>
        <filter id={`shadow-${illustrationId}`}>
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity=".12" />
        </filter>
        <linearGradient id={`fabric-${illustrationId}`} x2="1" y2="1">
          <stop stopColor={fill} />
          <stop offset="1" stopColor={fill} stopOpacity=".7" />
        </linearGradient>
      </defs>
      <g filter={`url(#shadow-${illustrationId})`}>
        <path
          d={paths[piece.category]}
          fill={`url(#fabric-${illustrationId})`}
          stroke={piece.color === "Branco" ? "#d6d3cb" : fill}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {piece.category === "Blusas" && (
          <path
            d="M100 59V169 M92 77h1 M92 100h1 M92 124h1"
            stroke="#b8b4a8"
            fill="none"
          />
        )}
        {piece.category === "Calças" && (
          <path
            d="M65 53h70 M100 40v51 M76 65 64 177 M124 65 136 177"
            stroke="#ffffff"
            opacity=".3"
            fill="none"
          />
        )}
        {piece.category === "Casacos" && (
          <path
            d="m74 36 10 57-8 16 24 44 24-44-8-16 10-21 M100 153v30"
            fill="none"
            stroke="#887b65"
          />
        )}
      </g>
    </svg>
  );
}
