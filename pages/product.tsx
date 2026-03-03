"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Protect, PricingTable, UserButton } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

import { jsPDF } from "jspdf";


const allowedPlans = ["user:basic_plan", "user:premium_plan"] as const;

function ConsultationForm() {
    const { getToken } = useAuth();
  
    // Form state
    const [POName, setPOName] = useState("");
    const [RequestDate, setRequestDate] = useState<string>(() => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    });
    const [notes, setNotes] = useState("");
  
    // Streaming state
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);
  
    // Abort SSE if component unmounts or user resubmits
    const abortRef = useRef<AbortController | null>(null);
  
    const handleExportPDF = () => {
      if (!output.trim()) return;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - margin * 2;
      let cursorY = margin;

      pdf.setFontSize(16);
      pdf.text("User Story Summary", margin, cursorY);
      cursorY += 8;

      pdf.setFontSize(11);
      pdf.text(`Product Owner: ${POName || "—"}`, margin, cursorY);
      cursorY += 6;
      pdf.text(`Date of request: ${RequestDate || "—"}`, margin, cursorY);
      cursorY += 10;

      pdf.setLineWidth(0.1);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;

      pdf.setFontSize(12);
      const lines: string[] = pdf.splitTextToSize(output, usableWidth) as string[];
      const lineHeight = 6;

      lines.forEach((line: string) => {
        if (cursorY > pageHeight - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.text(line, margin, cursorY);
        cursorY += lineHeight;
      });

      const safePO = POName.trim().replace(/[^\w\-]+/g, "_") || "po";
      pdf.save(`user-story_${safePO}_${RequestDate}.pdf`);
    };
  
    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
  
      abortRef.current?.abort();
      setOutput("");
      setLoading(true);
  
      const jwt = await getToken();
      if (!jwt) {
        setOutput("Authentication required");
        setLoading(false);
        return;
      }
  
      const controller = new AbortController();
      abortRef.current = controller;
  
      let buffer = "";
  
      try {
        await fetchEventSource("/api", {
          signal: controller.signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            product_owner: POName,
            date_of_request: RequestDate,
            notes,
          }),
          onmessage(ev) {
            buffer += ev.data;
            setOutput(buffer);
          },
          onclose() {
            setLoading(false);
          },
          onerror(err) {
            if (controller.signal.aborted) return;
  
            console.error("SSE error:", err);
            controller.abort();
            setLoading(false);
            setOutput((prev) =>
              prev
                ? prev + "\n\n⚠️ Connection error. Please try again."
                : "⚠️ Connection error. Please try again."
            );
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("SSE fatal error:", err);
        setLoading(false);
        setOutput("⚠️ Something went wrong. Please try again.");
      }
    }
  
    useEffect(() => {
      return () => abortRef.current?.abort();
    }, []);
  
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Business requirement Notes
        </h1>
  
        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
        >
          <div className="space-y-2">
            <label
              htmlFor="PO_user"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Product Owner Name
            </label>
            <input
              id="PO_user"
              type="text"
              required
              value={POName}
              onChange={(e) => setPOName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Enter PO's full name"
            />
          </div>
  
          <div className="space-y-2">
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Date of Request
            </label>
            <input
              id="date"
              type="date"
              required
              value={RequestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
  
          <div className="space-y-2">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              User Story Requirement Notes
            </label>
            <textarea
              id="notes"
              required
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Enter detailed business user area notes..."
            />
          </div>
  
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {loading ? "Generating User Story..." : "Generate User Story"}
          </button>
  
          {loading && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </form>
  
        {output && (
          <>
            <section className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <div className="markdown-content prose prose-blue dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {output}
                </ReactMarkdown>
              </div>
            </section>
  
            <div className="mt-4">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Export to PDF
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

export default function Product() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ Post-checkout: remove query param synchronously + refresh once (no infinite loop)
  useEffect(() => {
    const sub = searchParams.get("sub");
    if (sub !== "updated") return;

    const key = "clerk_checkout_handled";
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem(key) === "1") {
      window.history.replaceState(null, "", "/product");
      return;
    }

    sessionStorage.setItem(key, "1");
    window.history.replaceState(null, "", "/product");
    router.refresh();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="absolute top-4 right-4">
        <UserButton showName />
      </div>

      <Protect
        condition={(has) => allowedPlans.some((p) => has({ plan: p }))}
        fallback={
          <div className="container mx-auto px-4 py-12">
            <header className="text-center mb-12">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Choose Your Plan
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                Streamline your business requirements with AI-powered tailored user stories
              </p>
            </header>
            <div className="max-w-4xl mx-auto">
              <PricingTable
                for="user"
                newSubscriptionRedirectUrl="/product?sub=updated"
              />
            </div>
          </div>
        }
      >
        <ConsultationForm />
      </Protect>
    </main>
  );
}