import { Suspense } from "react";
import { useOutlet } from "react-router-dom";
import { PageLoadingSkeleton } from "@/components/premium/PageLoadingSkeleton";

export function DashboardOutlet() {
  const outlet = useOutlet();

  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      {outlet}
    </Suspense>
  );
}
