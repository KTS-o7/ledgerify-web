"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { Account, Category } from "@/lib/db/schema";

interface Props {
  accounts: Account[];
  categories: Category[];
}

export function TransactionSheetTrigger({ accounts, categories }: Props) {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const shouldAutoOpen = typeParam === "expense" || typeParam === "income";
  const [open, setOpen] = useState(false);
  const hasAutoOpened = useRef(false);

  // Auto-open the sheet when a ?type= param is present on mount
  useEffect(() => {
    if (shouldAutoOpen && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
        <Plus className="h-4 w-4" />
        Add transaction
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
          <SheetDescription>
            Capture the basics first. You can keep it simple and add more
            detail later.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <TransactionForm accounts={accounts} categories={categories} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
