import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * GoldenHourDefinitionCard — short explanation of the golden hour
 * window. Surfaces the Indian 60-minute convention without making
 * recovery promises.
 */
export function GoldenHourDefinitionCard() {
  return (
    <Card data-print="surface">
      <CardHeader>
        <CardTitle>Golden Hour, defined</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The first 60 minutes after a UPI, card, or netbanking transaction
          are the highest-probability window for the receiving bank or wallet
          to place a hold on the disputed amount. We do not extend or refresh
          this timer.
        </p>
      </CardContent>
    </Card>
  );
}
