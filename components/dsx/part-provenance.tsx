import { ArrowUpRight, BookOpen, Factory } from "lucide-react"
import { getPartReference, type PartReference } from "@/src/data/part-catalog"
import styles from "./part-provenance.module.css"

type PartProvenanceProps = {
  componentId: string
  compact?: boolean
}

function ReferenceDetails({ part }: { part: PartReference }) {
  return (
    <div className={styles.detailsBody}>
      <ul className={styles.specs}>
        {part.verifiedSpecs.map((spec) => (
          <li key={spec}>{spec}</li>
        ))}
      </ul>
      <p className={styles.fitNote}>{part.fitNote}</p>
      <ul className={styles.sources} aria-label="Manufacturer sources">
        {part.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <span>{source.title}</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
            <small>
              {source.scope === "product"
                ? "Product documentation"
                : "Company manufacturing evidence"}
            </small>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PartProvenance({
  componentId,
  compact = false,
}: PartProvenanceProps) {
  const part = getPartReference(componentId)
  if (!part) return null

  const originLabel =
    part.origin.status === "product-verified"
      ? "Documented product origin"
      : part.origin.status === "company-footprint"
        ? "Company sites documented; product origin unverified"
        : "Manufacturing origin unverified"

  return (
    <section
      className={styles.panel}
      data-compact={compact || undefined}
      aria-label={`${part.productName} product reference`}
    >
      <div className={styles.eyebrow}>
        <BookOpen size={13} aria-hidden="true" />
        <span>Hardware reference</span>
        <span className={styles.candidate}>Candidate</span>
      </div>
      <h3>{part.productName}</h3>
      <p className={styles.manufacturer}>{part.manufacturer}</p>
      <p className={styles.summary}>{part.summary}</p>
      <div className={styles.origin}>
        <Factory size={15} aria-hidden="true" />
        <div>
          <strong>{originLabel}</strong>
          <p>{part.origin.summary}</p>
        </div>
      </div>
      <p className={styles.procurement}>
        Reference research. No confirmed purchase, allocation or shipment.
      </p>
      {compact ? (
        <details className={styles.disclosure}>
          <summary>Specifications and manufacturer sources</summary>
          <ReferenceDetails part={part} />
        </details>
      ) : (
        <ReferenceDetails part={part} />
      )}
      <p className={styles.researched}>
        Researched <time dateTime={part.researchedAt}>{part.researchedAt}</time>
      </p>
    </section>
  )
}
