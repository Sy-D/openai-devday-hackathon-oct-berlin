import { Badge } from "@/components/ui/badge"
import { parts, type Factory } from "../data/network"
import { compatibility } from "../lib/planner"

export default function FactoryDetails({
  factory,
  orderQuantity,
  disrupted,
}: {
  factory: Factory
  orderQuantity: number
  disrupted: boolean
}) {
  const qualified = parts.filter(
    (part) =>
      compatibility(factory, part, orderQuantity * part.perKit).length === 0
  )
  return (
    <div className="grid gap-4 text-sm">
      <p className="text-muted-foreground">
        {factory.city}, {factory.country} ·{" "}
        {factory.kind === "print" ? "Print center" : factory.kind}
      </p>
      {factory.kind === "print" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {[...factory.processes, ...factory.materials].map((value) => (
              <Badge key={value} variant="secondary">
                {value}
              </Badge>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3 tabular-nums">
            <div>
              <dt className="text-muted-foreground">Batch capacity</dt>
              <dd>{factory.capacity} parts</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Queue</dt>
              <dd>
                {factory.queueHours +
                  (factory.id === "dresden" && disrupted ? 24 : 0)}
                h
              </dd>
            </div>
          </dl>
          {factory.id === "dresden" && disrupted && (
            <p className="text-destructive">Simulated queue delay · +24h</p>
          )}
          <p>
            {qualified.length
              ? `Qualified for ${qualified.map((part) => part.name.toLowerCase()).join(", ")}`
              : "No compatible parts in this order"}
          </p>
        </>
      ) : (
        <p>
          {factory.kind === "assembly"
            ? `All components meet here before delivery. Capacity ${factory.capacity} kits per batch.`
            : factory.kind === "supplier"
              ? "Purchased actuator · 12h preparation"
              : "Final destination for this order"}
        </p>
      )}
      {factory.qualification && (
        <p className="text-xs text-muted-foreground">{factory.qualification}</p>
      )}
    </div>
  )
}
