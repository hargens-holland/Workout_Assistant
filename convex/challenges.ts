import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Query to get active challenges for a user
 */
export const getActiveChallenges = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const today = new Date().toISOString().split("T")[0];
        const challenges = await ctx.db
            .query("challenges")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) =>
                q.and(
                    q.lte(q.field("startDate"), today),
                    q.gte(q.field("endDate"), today),
                    q.eq(q.field("completed"), false)
                )
            )
            .collect();

        return challenges;
    },
});

/**
 * Query to get all challenges for a user
 */
export const getUserChallenges = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const challenges = await ctx.db
            .query("challenges")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        return challenges.sort((a, b) => b.startDate.localeCompare(a.startDate));
    },
});

/**
 * Mutation to create a new challenge
 */
export const createChallenge = mutation({
    args: {
        userId: v.id("users"),
        challengeType: v.union(v.literal("pushup"), v.literal("pullup")),
        startDate: v.string(),
        endDate: v.string(),
        targetReps: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("challenges", {
            userId: args.userId,
            challengeType: args.challengeType,
            startDate: args.startDate,
            endDate: args.endDate,
            targetReps: args.targetReps,
            currentReps: 0,
            dailyLogs: [],
            completed: false,
        });
    },
});

/**
 * Mutation to log reps for a challenge on a specific date
 */
export const logChallengeReps = mutation({
    args: {
        challengeId: v.id("challenges"),
        date: v.string(),
        reps: v.number(),
    },
    handler: async (ctx, args) => {
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge) {
            throw new Error("Challenge not found");
        }

        // Update or add daily log
        const existingLogIndex = challenge.dailyLogs.findIndex(
            (log) => log.date === args.date
        );

        let updatedLogs;
        if (existingLogIndex >= 0) {
            updatedLogs = [...challenge.dailyLogs];
            updatedLogs[existingLogIndex] = { date: args.date, reps: args.reps };
        } else {
            updatedLogs = [...challenge.dailyLogs, { date: args.date, reps: args.reps }];
        }

        // Update current best reps if this is a new record
        const newCurrentReps = Math.max(challenge.currentReps, args.reps);

        // Check if challenge is completed
        const completed = newCurrentReps >= challenge.targetReps;

        return await ctx.db.patch(args.challengeId, {
            dailyLogs: updatedLogs,
            currentReps: newCurrentReps,
            completed,
        });
    },
});

/**
 * Mutation to complete a challenge
 */
export const completeChallenge = mutation({
    args: {
        challengeId: v.id("challenges"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.patch(args.challengeId, {
            completed: true,
        });
    },
});

/**
 * Query to get challenge progress
 */
export const getChallengeProgress = query({
    args: {
        challengeId: v.id("challenges"),
    },
    handler: async (ctx, args) => {
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge) {
            return null;
        }

        const today = new Date().toISOString().split("T")[0];
        const startDate = new Date(challenge.startDate);
        const endDate = new Date(challenge.endDate);
        const todayDate = new Date(today);

        const totalDays = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysElapsed = Math.ceil(
            (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysRemaining = Math.max(0, totalDays - daysElapsed);

        const progressPercent = (challenge.currentReps / challenge.targetReps) * 100;

        return {
            ...challenge,
            totalDays,
            daysElapsed,
            daysRemaining,
            progressPercent: Math.min(100, progressPercent),
        };
    },
});
