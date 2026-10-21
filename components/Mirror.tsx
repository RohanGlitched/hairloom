import s from "./Mirror.module.css";

type Props = {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  caption?: React.ReactNode;
  note?: React.ReactNode;
  priority?: boolean;
  children?: React.ReactNode;
};

/** A brass-framed arch mirror holding a portrait. The product's one recurring object. */
export function Mirror({ src, alt, size = "md", caption, note, priority, children }: Props) {
  return (
    <figure className={`${s.mirror} ${s[size]}`}>
      <div className={s.frame}>
        <div className={s.glass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} />
          {children}
        </div>
      </div>
      {(caption || note) && (
        <figcaption>
          {caption && <span className={s.cap}>{caption}</span>}
          {note && <span className={s.note}>{note}</span>}
        </figcaption>
      )}
    </figure>
  );
}
