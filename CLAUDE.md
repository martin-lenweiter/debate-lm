# DebateLM - Project Context for Claude

## Project Overview

A structured multi-LLM debate system where 2 debaters argue toward truth on a topic, moderated by a referee. Extended thinking enabled by default. User is pinged when human judgment is needed. User can provide files as context.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **LLM API**: Anthropic Claude API (with extended thinking)
- **Tools**: Web search, web fetch, Python execution (via API), file I/O
- **Data Format**: JSON schemas for debaters and referee outputs
- **State Management**: React hooks + Server Actions
- **UI Components**: shadcn/ui for debate interface

## Project Structure

```
/DebateLM/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Main debate interface
│   ├── globals.css             # Tailwind + custom styles
│   └── api/
│       ├── debate/
│       │   └── route.ts        # Debate orchestration API
│       ├── debater/
│       │   └── route.ts        # Debater agent API
│       └── referee/
│           └── route.ts        # Referee agent API
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── debate-interface.tsx   # Main debate UI
│   ├── debater-view.tsx       # Debater output display
│   ├── referee-view.tsx       # Referee verdict display
│   ├── user-input-modal.tsx   # User clarification prompt
│   └── evidence-card.tsx      # Evidence display component
├── lib/
│   ├── orchestrator.ts        # Debate flow controller
│   ├── debater.ts             # Debater agent logic
│   ├── referee.ts             # Referee agent logic
│   ├── tools/                 # Tool implementations
│   │   ├── web-search.ts
│   │   ├── web-fetch.ts
│   │   ├── python-exec.ts
│   │   └── file-ops.ts
│   ├── schemas.ts             # TypeScript types & Zod schemas
│   └── prompts.ts             # System prompts
├── project_brief.md           # Comprehensive project specification
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

## Development Commands

- `npm install` - Install dependencies
- `npm run dev` - Run the app locally (opens localhost:3000)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run test suite (if configured)

## Custom Commands

- `gcp "message"` - Custom git alias for commit + push
  (equivalent to `git add . && git commit -m "message" && git push`)

## Coding Conventions

- **Comments**: Minimalistic - only when necessary for readability
- **File Creation**: Avoid creating new files unless absolutely necessary
- **Style**: Follow existing codebase structure and conventions strictly
- **Spacing**: Match existing patterns between logical code blocks
- **Type Safety**: Use TypeScript types for all functions and components
- **JSDoc**: Use for complex functions, keep concise

## Feature Development Workflow

1. **Plan First**: For non-trivial tasks, always propose implementation plan before coding
2. **Ask Questions**: Don't hesitate to ask for clarifications - push back when needed
3. **Implement**: Write feature code + comprehensive tests
4. **Review**: Clean up code, remove useless comments, minimize diff
5. **Verification**: See what needs to be done in the "verification" section of CLAUDE.md
6. **Commit and Push**: Use `gcp` with clear, brief message

## Verification

**IMPORTANT: Always test in a live browser before handing over work.** Use browser automation tools to navigate to localhost:3000 and verify the application works correctly. Do not rely solely on build/lint passing - visually confirm the UI renders and functions as expected.

1. **Run linter**: `npm run lint` - No errors
2. **Build check**: `npm run build` - Build must succeed
3. **Start app**: `npm run dev` - Navigate to localhost:3000
4. **Browser checks**:
   - No console errors (open browser DevTools)
   - UI renders correctly without hydration mismatches
   - All components display properly
5. **Test debate flow**:
   - Start a debate with a simple topic
   - Verify debaters produce valid JSON output
   - Check referee correctly detects consensus/deadlock
   - Confirm user input modal appears when triggered
   - Test file upload for context documents
6. **Tool testing**:
   - Test web_search returns results
   - Verify web_fetch retrieves content
   - Check python_exec executes safely
   - Validate file operations work correctly
7. **Edge case testing**:
   - Test with empty/invalid inputs
   - Verify error handling for API failures
   - Check timeout handling for long-running debates
   - Test max rounds limit
   - Try uploading various file types
8. **JSON validation**:
   - Verify all outputs match defined schemas
   - Check confidence values are in valid ranges (0.0-1.0)
   - Ensure all required fields are present
9. **UI/UX testing**:
   - Test responsive design on different screen sizes
   - Verify loading states display correctly
   - Check real-time updates during debate rounds
   - Ensure debate history is preserved
10. **Commit**: Only if all checks pass - use `gcp "brief message"`

## What "Working" Means

- Application runs without errors
- Build succeeds with no TypeScript errors
- No console errors in browser
- Orchestrator runs complete debate flow
- Debaters produce valid JSON matching schema
- Referee correctly identifies consensus and deadlock
- Tools execute successfully and return expected results
- Error handling works gracefully
- User input modals display correctly when needed
- UI is responsive and loads quickly
- Real-time debate updates work smoothly

## Development Approach

- Keep it simple - avoid over-engineering
- Prioritize working features over perfect architecture
- Iterate quickly with fast feedback loops
- Focus on debate quality and truthfulness
- Ensure evidence grounding is robust

## Error Handling

- Validate JSON output from LLM calls
- Handle API failures gracefully with retries
- Catch tool execution errors and report clearly
- Fail fast with clear error messages
- Log errors to terminal for debugging
- Show user-friendly error messages in UI (not raw stack traces)
- Use error boundaries for React component errors
- Handle network failures gracefully

## Testing Requirements

- Add comprehensive tests for all new features
- Test edge cases: empty data, null values, boundaries, errors
- Test business logic thoroughly with unit tests
- Add integration tests for complete debate flows
- Mock external API calls in tests
- Test React components for proper rendering
- Run full test suite before committing (when configured)
- Aim for high coverage on critical paths
- Manual testing in browser is essential

## Debate Quality Checks

When implementing debate logic:
- Verify claim sources are properly typed and validated
- Check confidence scores are calibrated (0.0-1.0)
- Ensure evidence is grounded in sources
- Validate position changes cite triggers
- Confirm agreements track since_round correctly
- Test consensus detection is not premature
- Verify deadlock detection after 3+ stable rounds

## Security Rules (CRITICAL)

**Before every commit, verify:**

1. **No secrets in code**: Never commit files containing API keys, tokens, or credentials
2. **No production access**: Never connect to or query production systems
3. **Check staged files**: Run `git diff --cached` before committing to review all changes
4. **Forbidden patterns** - reject commits containing:
   - Hardcoded API keys or tokens
   - Production credentials or connection strings
   - `.env` files with real values
   - Secrets in configuration files

**If you find any of the above:**
- Do NOT commit
- Remove the sensitive content immediately
- Alert the user about the security risk

**Never:**
- Store credentials in any file (use environment variables)
- Commit files that bypass `.gitignore` security patterns
- Share API keys in code or documentation

## UI/UX Guidelines

- Keep UI clean and focused on the debate content
- Use shadcn/ui components for consistency
- Show clear visual distinction between debaters
- Display evidence sources prominently
- Use loading states during LLM calls
- Real-time updates for each debate round
- Make confidence scores visually intuitive
- Highlight position changes clearly

## React/Next.js Best Practices

- Use Server Components for API calls when possible
- Client Components only when needed (interactive UI)
- No hydration mismatches (avoid browser APIs in render)
- Use `useEffect` for client-only logic
- Proper loading and error states
- Optimize for performance (minimize re-renders)

## Notes

- Don't try to please - push back when needed
- Keep changes minimal while meeting requirements
- Ensure no existing functionality is deleted
- Focus on debate quality and evidence grounding
- Extended thinking is ON by default for all agents
- User interruption should be seamless and informative
- JSON output is the single source of truth for state
- Prioritize debate UX - the interface should feel like watching experts think
