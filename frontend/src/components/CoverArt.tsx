import Image from "next/image";

export default function CoverArt({
  coverUrl,
  initial,
  className,
  children,
}: {
  coverUrl?: string | null;
  initial: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0_10px,transparent_10px_20px)] ${className ?? ""}`}
    >
      {coverUrl ? (
        <Image src={coverUrl} alt="" fill sizes="(max-width: 640px) 100vw, 400px" className="object-contain" />
      ) : (
        <>
          <span className="text-4xl font-bold text-white/15">{initial}</span>
          <span className="absolute bottom-2 left-3 font-mono text-xs text-white/25">cover art</span>
        </>
      )}
      {children}
    </div>
  );
}
