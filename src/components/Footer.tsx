import { ZapIcon } from "lucide-react";
import Link from "next/link";

const Footer = () => {
    return (
        <footer className="border-t border-[#161B22] bg-[#0B0F14]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    {/* Logo and Copyright */}
                    <div className="flex flex-col items-center md:items-start gap-2">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="p-1.5 bg-[#161B22] rounded-xl group-hover:bg-[#1B212B] transition-all duration-200">
                                <ZapIcon className="w-4 h-4 text-[#C7F000]" />
                            </div>
                            <span className="text-lg font-semibold tracking-tight text-[#E6EAF0]">
                                FitSpark
                            </span>
                        </Link>
                        <p className="text-sm text-[#9AA3B2]">
                            © {new Date().getFullYear()} FitSpark - All rights reserved
                        </p>
                    </div>

                    {/* Links */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                        <Link
                            href="/about"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            About
                        </Link>
                        <Link
                            href="/terms"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            Terms
                        </Link>
                        <Link
                            href="/privacy"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            Privacy
                        </Link>
                        <Link
                            href="/contact"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            Contact
                        </Link>
                        <Link
                            href="/blog"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            Blog
                        </Link>
                        <Link
                            href="/help"
                            className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors rounded-xl px-2 py-1 hover:bg-[#161B22]/50"
                        >
                            Help
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};
export default Footer;
