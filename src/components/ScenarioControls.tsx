import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { ArrowRight, RotateCcw } from "lucide-react"
import { arrivalLabel, type Order } from "../data/network"
import {
  scenarioLimits,
  validScenario,
  scenarioChanged,
  type ScenarioInputs,
} from "../lib/scenario"

export default function ScenarioControls({
  order,
  onApply,
  onRestore,
}: {
  order: Order
  onApply: (inputs: ScenarioInputs) => void
  onRestore: () => void
}) {
  const [quantity, setQuantity] = useState(String(order.quantity))
  const [dueHours, setDueHours] = useState(String(order.dueHours))
  const inputs = { quantity: Number(quantity), dueHours: Number(dueHours) }
  const valid = validScenario(inputs)
  const dirty =
    inputs.quantity !== order.quantity || inputs.dueHours !== order.dueHours
  return (
    <Card className="scenario-card gap-4" aria-labelledby="scenario-title">
      <CardHeader className="scenario-heading">
        <div>
          <CardTitle>
            <h2 id="scenario-title">Order scenario</h2>
          </CardTitle>
          <CardDescription>
            <p>
              Simulate quantity or deadline changes for{" "}
              <strong>{order.id}</strong>.
            </p>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (valid && dirty) onApply(inputs)
          }}
        >
          <label className="scenario-field">
            <span>Order quantity</span>
            <div>
              <Input
                className="h-11"
                type="number"
                inputMode="numeric"
                min={scenarioLimits.quantity.min}
                max={scenarioLimits.quantity.max}
                step="1"
                aria-label="Simulated order quantity"
                aria-describedby="scenario-help"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={
                  !Number.isInteger(inputs.quantity) ||
                  inputs.quantity < 1 ||
                  inputs.quantity > 500
                }
              />
              <span>kits</span>
            </div>
          </label>
          <label className="scenario-field">
            <span>Delivery deadline</span>
            <div>
              <Input
                className="h-11"
                type="number"
                inputMode="numeric"
                min={scenarioLimits.dueHours.min}
                max={scenarioLimits.dueHours.max}
                step="1"
                aria-label="Simulated delivery deadline"
                aria-describedby="scenario-help"
                value={dueHours}
                onChange={(event) => setDueHours(event.target.value)}
                aria-invalid={
                  !Number.isInteger(inputs.dueHours) ||
                  inputs.dueHours < 1 ||
                  inputs.dueHours > 336
                }
              />
              <span>hours</span>
            </div>
          </label>
          <div className="scenario-deadline">
            <span>From the demo clock · 27 Oct, 08:00 CET</span>
            <strong>
              {arrivalLabel(valid ? inputs.dueHours : order.dueHours)}
            </strong>
          </div>
          <Button
            variant="default"
            className="h-11"
            type="submit"
            disabled={!valid || !dirty}
          >
            Apply scenario
            <ArrowRight size={15} />
          </Button>
          {scenarioChanged(order) && (
            <Button
              variant="ghost"
              className="h-11"
              type="button"
              onClick={onRestore}
            >
              <RotateCcw size={13} />
              Restore original
            </Button>
          )}
        </form>
        <div className="scenario-help" id="scenario-help" aria-live="polite">
          {!valid ? (
            <span className="scenario-error">
              Enter a whole quantity from 1 to 500 and a deadline from 1 to 336
              hours.
            </span>
          ) : dirty ? (
            <span>
              Changes are not applied yet. Apply this scenario to compare new
              routes.
            </span>
          ) : (
            <span>
              Print time assumes one batch per facility. Assembly time scales
              with the number of kits.
            </span>
          )}
          <span>No real orders or bookings change.</span>
        </div>
      </CardContent>
    </Card>
  )
}
