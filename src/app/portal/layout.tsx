import { Toaster } from "sonner";

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: "hsl(222 47% 9%)",
                        border: "1px solid hsl(217 33% 17%)",
                        color: "hsl(210 40% 96%)",
                    },
                }}
            />
        </>
    );
}
