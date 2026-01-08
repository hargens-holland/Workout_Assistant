"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";

const TestPage = () => {
    const angle = useMotionValue(0);
    const value = useTransform(angle, [-150, 150], [0, 100]);

    const [displayValue, setDisplayValue] = useState(50);

    value.on("change", (v) => {
        setDisplayValue(Math.round(Math.max(0, Math.min(100, v))));
    });

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="space-y-10 text-center">

                <h1 className="text-4xl font-extrabold tracking-tight">
                    ⚡ POWER CORE ⚡
                </h1>
                <p className="text-muted-foreground">
                    Drag the core. Don’t overcharge it.
                </p>

                {/* DIAL */}
                <div className="relative flex items-center justify-center">
                    {/* Glow */}
                    <motion.div
                        className="absolute w-72 h-72 rounded-full bg-blue-500 blur-3xl"
                        animate={{
                            opacity: displayValue / 100,
                            scale: 1 + displayValue / 200,
                        }}
                    />

                    {/* Outer Ring */}
                    <motion.div
                        drag="x"
                        dragConstraints={{ left: -150, right: 150 }}
                        style={{ rotate: angle }}
                        className="w-64 h-64 rounded-full border-[6px] border-blue-400 flex items-center justify-center cursor-grab"
                        whileTap={{ scale: 1.05 }}
                    >
                        {/* Inner Core */}
                        <motion.div
                            className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 shadow-[0_0_60px_#3b82f6]"
                            animate={{
                                scale: 1 + displayValue / 300,
                            }}
                        />
                    </motion.div>
                </div>

                {/* VALUE */}
                <div className="text-5xl font-mono font-bold tracking-widest">
                    {displayValue}%
                </div>

                <p className="text-xs text-muted-foreground">
                    (This is a test component. People WILL play with it.)
                </p>

            </div>
        </div>
    );
};

export default TestPage;
