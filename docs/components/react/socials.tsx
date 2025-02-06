import Link from "next/link";
import { FaDiscord, FaGithub, FaEdit } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const socials = [
    {
        icon: FaDiscord,
        href: "https://discord.com/invite/6dffbvGU3D"
    },
    {
        icon: FaGithub,
        href: "https://github.com/CopilotKit/CopilotKit"
    },
    {
        icon: FaXTwitter,
        href: "https://x.com/copilotkit"
    }
]

export type SocialProps = {
    className?: string;
}

export function Socials({ className }: SocialProps) {
    return (
        <div className={cn("flex gap-1 justify-end", className)}>
            {socials.map((social, index) => (
                <Button 
                    key={index}
                    variant="ghost" 
                    size="icon" 
                    asChild 
                    className="h-10 w-10 text-indigo-500/80 hover:bg-indigo-500 hover:text-white"
                >
                    <Link href={social.href} target="_blank" rel="noopener noreferrer">
                        <social.icon className="w-4 h-4" />
                    </Link>
                </Button>
            ))}
        </div>
    )
}