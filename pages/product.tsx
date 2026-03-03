"use client"

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useAuth } from '@clerk/nextjs';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Protect, PricingTable, UserButton } from '@clerk/nextjs';
import { useRouter, useSearchParams } from "next/navigation";

const allowedPlans = ["user:basic_plan", "user:premium_plan"] as const;

function IdeaGenerator() {
    const { getToken } = useAuth();
    const [idea, setIdea] = useState<string>('…loading');
    // Abort SSE on unmount / re-render (prevents double streams in dev strict mode)
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        let buffer = '';
        const ac = new AbortController();
        abortRef.current = ac;
        (async () => {
            const jwt = await getToken();
            if (!jwt) {
                setIdea('Authentication required');
                return;
            }

            try {
                await fetchEventSource("/api", {
                  signal: ac.signal,
                  headers: { Authorization: `Bearer ${jwt}` },
                  onmessage(ev) {
                    buffer += ev.data;
                    setIdea(buffer);
                  },
                  onerror(err) {
                    // If we aborted, do nothing.
                    if (ac.signal.aborted) return;
        
                    console.error("SSE error:", err);
                    // Returning without throw lets fetch-event-source retry by default
                  },
                });
              } catch (err) {
                if (ac.signal.aborted) return;
                console.error("SSE fatal error:", err);
                setIdea("Something went wrong generating the idea.");
              }
            })();
        
            return () => {
              ac.abort();
            };
          }, [getToken]);

    return (
        <div className="container mx-auto px-4 py-12">
            {/* Header */}
            <header className="text-center mb-12">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                    Business Idea Generator
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    AI-powered innovation at your fingertips
                </p>
            </header>

            {/* Content Card */}
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 backdrop-blur-lg bg-opacity-95">
                    {idea === '…loading' ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-pulse text-gray-400">
                                Generating your business idea...
                            </div>
                        </div>
                    ) : (
                        <div className="markdown-content text-gray-700 dark:text-gray-300">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                            >
                                {idea}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Product() {
    const router = useRouter();
    const searchParams = useSearchParams();
   // const handledCheckoutRef = useRef(false);

    useEffect(() => {
        const sub = searchParams.get("sub");
        if (sub !== "updated") return;
        const key = "clerk_checkout_handled";
        if (typeof window === "undefined") return;
        if (sessionStorage.getItem(key) === "1") {
          // If we already handled it, make sure URL is clean and stop.
          window.history.replaceState(null, "", "/product");
          return;
        }    
        sessionStorage.setItem(key, "1");
        // Remove query param synchronously (no async router.replace race)
        window.history.replaceState(null, "", "/product");
        // Now refresh once to re-evaluate plans
        router.refresh();
      }, [router, searchParams]);
      
    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            {/* User Menu in Top Right */}
            <div className="absolute top-4 right-4">
                <UserButton showName={true} />
            </div>

            {/* Subscription Protection */}
            <Protect
                condition={(has) => allowedPlans.some((p) => has({ plan: p }))}
                fallback={
                    <div className="container mx-auto px-4 py-12">
                        <header className="text-center mb-12">
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                                Choose Your Plan
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                                Unlock unlimited AI-powered business ideas
                            </p>
                        </header>
                        <div className="max-w-4xl mx-auto">
                            <PricingTable for="user" newSubscriptionRedirectUrl="/product?sub=updated" />
                        </div>
                    </div>
                }
            >
                <IdeaGenerator />
            </Protect>
        </main>
    );
}