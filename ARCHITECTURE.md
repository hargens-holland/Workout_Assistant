# Workout Assistant - Architecture & Structure

## Overview
AI-powered workout planner and tracker built with Next.js, Convex, and Clerk authentication. The app helps users create personalized fitness plans, track workouts and nutrition, and monitor progress.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Convex (serverless backend)
- **Authentication**: Clerk
- **Styling**: Tailwind CSS, shadcn/ui components
- **AI**: Google Gemini (for plan generation)

## Project Structure

```
workout_assistant/
├── convex/                    # Backend (Convex serverless functions)
│   ├── _generated/           # Auto-generated Convex types
│   ├── auth.config.ts        # Clerk authentication config
│   ├── chat.ts               # Chat intent router and command handler
│   ├── http.ts               # HTTP endpoints
│   ├── mealLogs.ts           # Meal logging queries/mutations
│   ├── plans.ts              # Plan generation, CRUD, progress tracking
│   ├── schema.ts             # Database schema definitions
│   ├── splits.ts             # Workout split templates
│   ├── users.ts              # User queries
│   └── workoutEditing.ts     # Workout session editing
│
├── data/                     # Static data
│   └── exercises.json        # Exercise database
│
├── public/                   # Static assets
│   ├── ai-avatar.png
│   ├── hero-ai*.png
│   └── screenshot-for-readme.png
│
├── scripts/                  # Utility scripts
│   ├── import-exercises.ts   # Exercise import script
│   └── README.md
│
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/           # Auth routes (Clerk)
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   ├── admin/            # Admin pages
│   │   │   ├── exercises/
│   │   │   └── meals/
│   │   ├── calendar/         # Calendar view
│   │   ├── chat/             # AI chat interface
│   │   ├── generate-program/ # Plan generation
│   │   ├── home/             # Daily execution dashboard
│   │   ├── meals/             # Nutrition tracking
│   │   ├── profile/          # User profile & settings
│   │   ├── progress/         # Progress tracking & analytics
│   │   ├── test/             # Test pages
│   │   ├── workouts/         # Workout overview
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Landing page
│   │   └── globals.css       # Global styles
│   │
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   │   ├── accordion.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── tabs.tsx
│   │   ├── CornerElements.tsx
│   │   ├── Footer.tsx
│   │   ├── Navbar.tsx
│   │   ├── NoFitnessPlan.tsx
│   │   ├── ProfileHeader.tsx
│   │   ├── TerminalOverlay.tsx
│   │   └── UserPrograms.tsx
│   │
│   ├── constants/           # App constants
│   │   └── index.js
│   │
│   ├── lib/                 # Utility functions
│   │   └── utils.ts
│   │
│   ├── providers/           # React context providers
│   │   └── ConvexClerkProvider.tsx
│   │
│   └── middleware.ts        # Next.js middleware (route protection)
│
├── components.json          # shadcn/ui config
├── eslint.config.mjs       # ESLint config
├── next.config.ts          # Next.js config
├── package.json            # Dependencies
├── postcss.config.mjs      # PostCSS config
└── tsconfig.json           # TypeScript config
```

## Database Schema (Convex)

### Tables

#### `users`
- `name`: string
- `email`: string
- `avatar`: optional string
- `clerkId`: string (indexed)
- **Indexes**: `by_clerk_id`

#### `plans`
- `userId`: Id<"users"> (indexed)
- `name`: string
- `workoutPlan`: object (schedule, exercises)
- `dietPlan`: object (dailyCalories, meals)
- `trainingStrategy`: optional object (goal_type, primary_focus, time_horizon_weeks, etc.)
- `executionConfig`: optional object (split_type, intensity_distribution)
- `isActive`: boolean (indexed)
- **Indexes**: `by_user_id`, `by_active`

#### `exercises`
- `name`: string
- `bodyPart`: string (indexed)
- `isCompound`: boolean (indexed)
- `equipment`: optional string
- `instructions`: optional array<string>
- **Indexes**: `by_body_part`, `by_compound`

#### `meals`
- `name`: string (indexed)
- `foods`: array<string>
- `calories`: number
- `instructions`: array<string>
- `mealType`: optional array<string>
- **Indexes**: `by_name`

#### `workout_sessions`
- `userId`: Id<"users"> (indexed)
- `planId`: Id<"plans"> (indexed)
- `date`: string (indexed, YYYY-MM-DD)
- `weekNumber`: number
- `dayOfWeek`: string
- `intensity`: string
- **Indexes**: `by_user_id`, `by_plan_id`, `by_date`

#### `exercise_sets`
- `sessionId`: Id<"workout_sessions"> (indexed)
- `exerciseId`: Id<"exercises"> (indexed)
- `plannedWeight`: number
- `plannedReps`: number
- `actualWeight`: optional number
- `actualReps`: optional number
- `actualRPE`: optional number
- `completed`: boolean
- `setNumber`: number
- **Indexes**: `by_session_id`, `by_exercise_id`

#### `daily_meals`
- `sessionId`: Id<"workout_sessions"> (indexed)
- `mealId`: Id<"meals"> (indexed)
- `mealType`: string
- `completed`: boolean
- `order`: number
- **Indexes**: `by_session_id`, `by_meal_id`

#### `blocked_items`
- `userId`: Id<"users"> (indexed)
- `itemType`: "exercise" | "meal"
- `itemId`: string
- `itemName`: string
- **Indexes**: `by_user_id`, `by_item` (itemType, itemId)

#### `meal_logs`
- `userId`: Id<"users"> (indexed)
- `date`: string (indexed, YYYY-MM-DD)
- `name`: string
- `calories`: number
- `protein`: optional number
- `mealType`: optional string
- **Indexes**: `by_user_id`, `by_date`, `by_user_and_date`

## Key Backend Functions (Convex)

### `convex/plans.ts`
- `createPlan` - Create new fitness plan
- `generatePlan` - AI-powered plan generation
- `getActivePlan` - Get user's active plan
- `getWorkoutsByDateRange` - Get workouts for date range
- `calculateProgressionForExercise` - Calculate weight progression
- `createExerciseSet` - Create exercise set
- `updateExerciseSet` - Update set with actual values
- `getExerciseProgress` - Get progress for specific exercise
- `getAllExerciseProgress` - Get progress for all exercises
- `getBodyPartStrength` - Analyze body part strength
- `regenerateExercise` - Replace exercise in workout
- `regenerateMeal` - Replace meal in plan
- `blockItem` - Block exercise or meal
- `createMeal` - Create meal
- `getAllMeals` - Get all meals
- `createDailyMeal` - Assign meal to session

### `convex/workoutEditing.ts`
- `getTodayWorkout` - Get today's workout
- `reduceWorkoutVolume` - Remove sets/exercises
- `addAccessoryExercise` - Add exercise to upcoming sessions
- `moveWorkoutSession` - Reschedule workout
- `getUpcomingWorkouts` - Get next 7 days
- `getWorkoutHistory` - Get last 14 days

### `convex/mealLogs.ts`
- `getMealLogsByDate` - Get logs for specific date
- `getMealLogsByDateRange` - Get logs for date range
- `createMealLog` - Create meal log
- `updateMealLog` - Update meal log
- `deleteMealLog` - Delete meal log

### `convex/chat.ts`
- `chatCommand` - Intent router for chat commands
- Supports intents: WORKOUT_SWAP_EXERCISE, WORKOUT_MAKE_EASIER, WORKOUT_ADD_FOCUS, MEAL_SUGGEST, MEAL_LOG_QUICK, SCHEDULE_MOVE_WORKOUT, BLOCK_ITEM

### `convex/users.ts`
- `getUserByClerkId` - Get user by Clerk ID

## Frontend Pages

### `/` (Landing)
- Marketing page for non-authenticated users
- Redirects authenticated users to `/home`

### `/home` (Daily Dashboard)
- Today's workout with quick complete functionality
- Today's nutrition (targets vs actual)
- Quick meal logging
- Weekly stats

### `/workouts`
- Current focus from training strategy
- Upcoming workouts (next 7 days)
- Workout history (last 14 days)
- Session detail view with editing

### `/meals`
- Daily calorie and protein targets
- Today's planned and logged meals
- Suggested meals with assign functionality
- Weekly calorie trend chart

### `/progress`
- Goal progress tracking
- Exercise progress charts (weight, volume over time)
- Body part strength visualization
- Future projections
- Top exercises summary

### `/calendar`
- Month view of workouts and meals
- Reschedule support (move workouts)
- Combined workout + meals view

### `/chat`
- AI chat interface
- Natural language command processing
- Intent router with deterministic parsing
- Shows data changes made

### `/profile`
- User stats and preferences
- Goal, injuries, equipment, diet preferences
- Active plan selection
- Split change functionality
- Plan management

### `/generate-program`
- Plan generation form
- User input collection
- AI-powered plan creation

### `/admin/exercises` & `/admin/meals`
- Admin pages for managing exercises and meals

## Components

### Layout Components
- `Navbar` - Main navigation (Home, Workouts, Progress, Meals, Calendar, Chat, Profile)
- `Footer` - Footer component
- `CornerElements` - Decorative corner elements

### UI Components (shadcn/ui)
- `Button` - Button component
- `Card` - Card container
- `Accordion` - Collapsible content
- `Tabs` - Tab navigation

### Feature Components
- `NoFitnessPlan` - Empty state for no plan
- `ProfileHeader` - Profile header display
- `TerminalOverlay` - Terminal-style overlay
- `UserPrograms` - User's program list

## Routing & Authentication

### Protected Routes
Protected by middleware (`src/middleware.ts`):
- `/home`
- `/workouts`
- `/meals`
- `/calendar`
- `/chat`
- `/profile`
- `/progress`

### Public Routes
- `/` (landing)
- `/sign-in`
- `/sign-up`
- `/generate-program`

## Key Features

### Plan Generation
- AI-powered plan creation using Google Gemini
- Considers user goals, injuries, equipment, diet preferences
- Generates workout plan and meal plan
- Creates training strategy with priorities

### Workout Tracking
- Planned vs actual weight/reps tracking
- Set completion tracking
- RPE (Rate of Perceived Exertion) tracking
- Volume reduction (make easier/shorter)
- Exercise swapping
- Accessory exercise addition

### Nutrition Tracking
- Daily calorie and protein targets
- Planned meals from plan
- Manual meal logging
- Weekly calorie trends
- Meal suggestions

### Progress Analytics
- Exercise progress over time
- Body part strength analysis
- Goal progress tracking
- Future weight projections
- Top exercises summary

### Chat Interface
- Natural language commands
- Deterministic intent parsing
- Supports workout modifications, meal logging, scheduling

## Data Flow

1. **User Authentication**: Clerk handles auth, Convex stores user records
2. **Plan Creation**: User inputs → AI generation → Plan stored in Convex
3. **Workout Execution**: Plan → Sessions → Sets → User completes → Actual values stored
4. **Progress Tracking**: Completed sets → Progress queries → Analytics displayed
5. **Nutrition**: Plan meals + manual logs → Daily totals → Progress tracking

## Environment Setup

Required environment variables:
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `CONVEX_DEPLOY_KEY` - Convex deploy key
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google Gemini API key

## Development

- Frontend: `npm run dev` (Next.js dev server)
- Backend: Convex automatically syncs on file changes
- Type generation: Convex auto-generates types in `convex/_generated/`
