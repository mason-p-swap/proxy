import { Toaster } from "@/components/ui/sonner"
import { TopBar } from "@/components/top-bar"
import { BlocksBackground } from "@/components/blocks-background"
import { SiteFooter } from "@/components/site-footer"
import { HomePage } from "@/pages/home"
import { TradePage } from "@/pages/trade"
import { MarketsPage } from "@/pages/markets"
import { DashboardPage } from "@/pages/dashboard"
import { SupplyPage } from "@/pages/supply"
import { BorrowPage } from "@/pages/borrow"
import { DocsPage } from "@/pages/docs"
import { SimulatorPage } from "@/pages/simulator"
import { HowItWorksPage } from "@/pages/how-it-works"
import { FaqPage } from "@/pages/faq"
import { useRouter } from "@/lib/router"

function AppContent() {
  const { route, navigate } = useRouter()

  return (
    <div className="relative min-h-svh bg-background">
      <BlocksBackground />
      <TopBar route={route} navigate={navigate} />
      <main>
        {route.name === "home" && <HomePage navigate={navigate} />}
        {route.name === "trade" && <TradePage navigate={navigate} />}
        {route.name === "markets" && <MarketsPage navigate={navigate} />}
        {route.name === "defi" && <DashboardPage navigate={navigate} />}
        {route.name === "supply" && <SupplyPage navigate={navigate} />}
        {route.name === "borrow" && <BorrowPage navigate={navigate} />}
        {route.name === "docs" && <DocsPage navigate={navigate} />}
        {route.name === "sim" && <SimulatorPage />}
        {route.name === "how" && <HowItWorksPage navigate={navigate} />}
        {route.name === "faq" && <FaqPage navigate={navigate} />}
      </main>
      <SiteFooter navigate={navigate} />
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
