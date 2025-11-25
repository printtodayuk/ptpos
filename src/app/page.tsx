import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-12">
        <Logo />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <div className="border rounded-lg p-8 flex flex-col items-center text-center">
          <Globe className="h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Visit Our Website</h2>
          <p className="text-muted-foreground mb-6">
            Explore our products and services on our main company website.
          </p>
          <Button asChild>
            <a href="https://www.printtodayuk.com" target="_blank" rel="noopener noreferrer">
              Go to printtodayuk.com <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
        <div className="border rounded-lg p-8 flex flex-col items-center text-center">
          <ArrowRight className="h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Access the App</h2>
          <p className="text-muted-foreground mb-6">
            Log in to the internal application to manage your business operations.
          </p>
          <Button asChild>
            <Link href="/dashboard">
              Go to App <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
