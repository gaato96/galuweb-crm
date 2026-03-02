import PortalClient from "./portal-client";

export default function PortalPage({ params }: { params: { slug: string } }) {
    return <PortalClient slug={params.slug} />;
}
