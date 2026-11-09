import { BasketProvider } from "@/components/basket/basket-provider";
import { Shell } from "@/components/basket/shell";

export default function BasketLayout({ children }: LayoutProps<"/basket">) {
  return (
    <BasketProvider>
      <Shell>{children}</Shell>
    </BasketProvider>
  );
}
