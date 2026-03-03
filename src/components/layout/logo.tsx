import { cn } from "@/lib/utils";

export default function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                {/* Evolution/Idea Icon: Lightbulb with Brain */}
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Rays */}
                    <path d="M50 5V15M25 20L32 27M75 20L68 27" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" />

                    {/* Bulb Outline */}
                    <path d="M50 85C35 85 22 72 22 55C22 42 30 30 42 26C45 25 48 22 48 18V18C48 15 52 15 52 18V18C52 22 55 25 58 26C70 30 78 42 78 55C78 72 65 85 50 85Z" stroke="#8B5CF6" strokeWidth="4" />
                    <path d="M40 85H60M42 92H58M45 99H55" stroke="#8B5CF6" strokeWidth="4" strokeLinecap="round" />

                    {/* Brain inside */}
                    <path
                        d="M50 35C44 35 40 39 40 44C40 45 40.5 46 41 47C39 48 38 51 38 53C38 56 40 58 43 58C43 61 45 64 49 64C50 64 51 63.5 52 63C53 64 55 64 56 64C60 64 62 61 62 58C65 58 67 56 67 53C67 51 66 48 64 47C64.5 46 65 45 65 44C65 39 61 35 55 35H50Z"
                        fill="#FBBF24"
                        className="animate-pulse-soft"
                    />
                    <path d="M52 35V64" stroke="#D97706" strokeWidth="1" strokeLinecap="round" />
                </svg>
            </div>
            {!collapsed && (
                <div className="flex flex-col leading-tight animate-fade-in whitespace-nowrap">
                    <span className="text-xl font-black text-white tracking-tighter uppercase italic">Galu</span>
                    <span className="text-[10px] font-bold text-amber-400 tracking-[0.2em] uppercase -mt-0.5">Diseño Web</span>
                </div>
            )}
        </div>
    );
}
