import { BasketProvider } from "@/components/basket/basket-provider";
import { Shell } from "@/components/basket/shell";

/**
 * A basket exists only in Walrus Memory and is recalled by the browser after load,
 * so its pages render behind a client-side gate rather than in the static shell.
 */
export const instant = false;

export default function BasketLayout({ children }: LayoutProps<"/basket">) {
  return (
    <BasketProvider>
      <Shell>{children}</Shell>
    </BasketProvider>
  );
}
