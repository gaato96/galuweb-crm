import type { Metadata } from "next";
import PortalClient from "./portal-client";

export const metadata: Metadata = {
    title: "Portal del proyecto — Galu Diseño Web",
    robots: { index: false, follow: false },
};

export default function PortalPage({ params }: { params: { slug: string } }) {
    return <PortalClient slug={params.slug} />;
}
