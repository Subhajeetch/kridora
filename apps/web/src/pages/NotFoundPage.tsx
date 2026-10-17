import { Link } from "react-router"
import { buttonVariants } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">We could not find that page</h1>
      <p className="mt-3 text-muted-foreground">The link may be wrong, or the game is not available right now.</p>
      <Link to="/games" className={buttonVariants({ size: "lg", className: "mt-8" })}>
        Browse games
      </Link>
    </section>
  )
}
