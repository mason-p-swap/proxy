import { Toaster } from "@/components/ui/sonner"
import { TopBar } from "@/components/top-bar"
import { BlocksBackground } from "@/components/blocks-background"
import { SiteFooter } from "@/components/site-footer"
import { HomePage } from "@/pages/home"
import { ExchangePage } from "@/pages/exchange"
import { OrderLookupPage } from "@/pages/lookup"
import { MarketsPage } from "@/pages/markets"
import { DefiPage } from "@/pages/defi"
import { DashboardPage } from "@/pages/dashboard"
import { SupplyPage } from "@/pages/supply"
import { BorrowPage } from "@/pages/borrow"
import { SimulatorPage } from "@/pages/simulator"
import { HowItWorksPage } from "@/pages/how-it-works"
import { FaqPage } from "@/pages/faq"
import { useRouter } from "@/lib/router"

function AppContent() {
  const { route, navigate } = useRouter()

  const showHeader = route.name !== "exchange"

  return (
    <div className="relative min-h-svh bg-background">
      <BlocksBackground />
      {showHeader && <TopBar route={route} navigate={navigate} />}
      <main>
        {route.name === "home" && <HomePage navigate={navigate} />}
        {route.name === "exchange" && <ExchangePage key={route.id} route={route} navigate={navigate} />}
        {route.name === "lookup" && <OrderLookupPage navigate={navigate} />}
        {route.name === "markets" && <MarketsPage navigate={navigate} />}
        {route.name === "defi" && <DefiPage navigate={navigate} />}
        {route.name === "dashboard" && <DashboardPage navigate={navigate} />}
        {route.name === "supply" && <SupplyPage navigate={navigate} />}
        {route.name === "borrow" && <BorrowPage navigate={navigate} />}
        {route.name === "sim" && <SimulatorPage />}
        {route.name === "how" && <HowItWorksPage navigate={navigate} />}
        {route.name === "faq" && <FaqPage navigate={navigate} />}
      </main>
      {showHeader && <SiteFooter navigate={navigate} />}
    </div>
  )
}

export function App() {
  return (
    <>
      <AppContent />
      <Toaster />
    </>
  )
}

export default App
