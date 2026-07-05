import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCardIcon, BankIcon, CheckCircleIcon } from "@phosphor-icons/react"

export default async function PortalBillingPaymentsPage() {
	return (
		<main className="flex flex-1 flex-col gap-6 p-6 pt-0">
			<header>
				<h1 className="text-2xl font-bold">Payments</h1>
				<p className="text-muted-foreground">
					Manage payment confirmations and gateways
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-3">
				<Link href="/portal/payments/confirmations" className="block">
					<Card className="h-full transition-colors hover:border-primary">
						<CardHeader className="flex flex-row items-center gap-3">
							<CheckCircleIcon className="h-8 w-8 text-primary" />
							<CardTitle>Confirmations</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								View and manage payment confirmations
							</p>
						</CardContent>
					</Card>
				</Link>

				<Link href="/portal/payments/gateways" className="block">
					<Card className="h-full transition-colors hover:border-primary">
						<CardHeader className="flex flex-row items-center gap-3">
							<CreditCardIcon className="h-8 w-8 text-primary" />
							<CardTitle>Gateways</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Configure payment gateways
							</p>
						</CardContent>
					</Card>
				</Link>

				<Link href="/portal/payments/bank-accounts" className="block">
					<Card className="h-full transition-colors hover:border-primary">
						<CardHeader className="flex flex-row items-center gap-3">
							<BankIcon className="h-8 w-8 text-primary" />
							<CardTitle>Bank Accounts</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Manage bank account details
							</p>
						</CardContent>
					</Card>
				</Link>
			</div>
		</main>
	)
}
