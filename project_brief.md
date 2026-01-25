## DebateLM: Project Brief v1.0

---

### Overview

A structured multi-LLM debate system where 2 debaters argue toward truth on a topic, moderated by a referee. Extended thinking enabled by default. User is pinged when human judgment is needed. User can provide files as context.

---

### Core Components

| Component | Model Config | Role |
|-----------|--------------|------|
| Debater A | Extended thinking ON | Argues position, grounds claims in evidence |
| Debater B | Extended thinking ON | Argues position, grounds claims in evidence |
| Referee | Extended thinking ON | Tracks state, detects consensus, escalates to user |
| Orchestrator | Code | Controls flow, manages history, handles user I/O |

---

### User Inputs

| Input | When | Purpose |
|-------|------|---------|
| Topic | Debate start | The question to debate |
| Files | Debate start (optional) | Context documents, data, prior analysis |
| Clarifications | Mid-debate (on request) | Resolve ambiguity, provide values/constraints |
| Files (additional) | Mid-debate (optional) | Additional context when responding to escalation |

---

### Tools Available to Debaters

Tools are used **during** a debater's turn (within extended thinking / agentic execution). The JSON output is the finished product after tool use.

| Tool | Signature | Purpose |
|------|-----------|---------|
| `web_search` | `(query: str) -> results[]` | Find data from reputable sources |
| `web_fetch` | `(url: str) -> content` | Read full content when snippets insufficient |
| `python_exec` | `(code: str) -> output` | Compute, simulate, analyze |
| `file_write` | `(path: str, content: str)` | Persist analysis across turns |
| `file_read` | `(path: str) -> content` | Read user-provided files or saved work |

Referee has read-only access to tool outputs for verification.

---

### Claim Source Types

| Type | Description | Strength | Defeater |
|------|-------------|----------|----------|
| `data` | Empirical evidence, reputable source | High | Better data, methodological flaws |
| `computation` | Calculation, simulation, model | High | Input errors, model assumptions |
| `first_principles` | Axioms + logical derivation | High | Invalid axioms, logical errors |
| `analogy` | Structurally similar cases | Medium | Disanalogy, relevant differences |
| `thought_experiment` | Hypothetical testing principles | Medium | Flawed setup, hidden assumptions |
| `expert_consensus` | Domain experts broadly agree | Medium-Low | Must cite underlying data when challenged |
| `intuition` | Heuristic, gut sense | Low | Any stronger source type |

Higher-strength sources defeat lower. Same-strength conflicts require deeper analysis.

---

### Confidence Scale

| Score | Label | Betting Odds | Behavior |
|-------|-------|--------------|----------|
| 0.95+ | Near certain | 20:1 | Extraordinary evidence needed to shift |
| 0.80–0.94 | High | 4:1 | Clear counterevidence would shift |
| 0.60–0.79 | Moderate | 2:1 | Open to strong arguments |
| 0.40–0.59 | Uncertain | ~1:1 | Actively seeking information |
| 0.20–0.39 | Low | 1:2 | Leaning against, not committed |
| <0.20 | Near certain against | 1:4+ | Strong evidence needed to shift toward |

Debaters must decompose confidence into drivers with direction and magnitude.

---

### Referee Verdicts

| Status | Trigger | Orchestrator Action |
|--------|---------|---------------------|
| `CONTINUE` | Productive disagreement ongoing | Proceed to next round |
| `USER_INPUT_NEEDED` | Debate hinges on user context, values, or unresolvable dispute | Pause, prompt user |
| `CONSENSUS_REACHED` | Genuine agreement with cited reasoning | Return synthesis |
| `DEADLOCK` | Positions stable 3+ rounds | Escalate to user with summary |

---

### Consensus Criteria

**Accept when:**
- Positions are compatible (not necessarily identical)
- Both debaters cite what evidence drove convergence
- Key disagreements resolved OR explicitly scoped as value judgments
- Minimum 3 substantive exchanges occurred

**Reject if:**
- Capitulation without cited reasoning
- Core disagreements glossed over
- Convergence in <3 rounds without major new evidence

---

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User provides: topic, optional files                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ ROUND N                                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Debater A turn                                       │   │
│  │  • Extended thinking                                 │   │
│  │  • Uses tools (search, fetch, python, files)        │   │
│  │  • Outputs Debater JSON                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Debater B turn                                       │   │
│  │  • Sees Debater A's JSON in context                 │   │
│  │  • Extended thinking                                 │   │
│  │  • Uses tools                                        │   │
│  │  • Outputs Debater JSON                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Referee                                              │   │
│  │  • Sees both Debater JSONs                          │   │
│  │  • Extended thinking                                 │   │
│  │  • Outputs Referee JSON (verdict)                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Orchestrator checks status    │
              └───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
     CONTINUE          USER_INPUT_NEEDED     CONSENSUS_REACHED
          │            or DEADLOCK           or max rounds
          │                   │                   │
          │                   ▼                   │
          │         ┌─────────────────┐           │
          │         │ Prompt user     │           │
          │         │ (+ optional     │           │
          │         │  file upload)   │           │
          │         └─────────────────┘           │
          │                   │                   │
          ▼                   ▼                   ▼
      Round N+1          Round N+1            Return
                                              result
```

---

### JSON Consumption

#### Debater JSON

| Consumer | Uses For |
|----------|----------|
| Referee | Evaluate evidence quality, track positions, detect consensus |
| Other debater | Context for next turn—what to respond to |
| Orchestrator | Check `user_question` field, append to history |
| History log | Audit trail, user review |

#### Referee JSON

| Consumer | Uses For |
|----------|----------|
| Orchestrator | Branch on `status` (continue, return, prompt user) |
| History log | Track debate evolution |
| User (on escalation) | Understand state, contested points, what input needed |

---

### JSON Schemas

#### Debater Output

```json
{
  "position": {
    "summary": "Top-level stance in 1-3 sentences",
    "sub_positions": [
      {
        "topic": "Specific sub-question or branch",
        "stance": "Position on this aspect",
        "confidence": 0.00
      }
    ]
  },
  "overall_confidence": 0.00,
  "confidence_drivers": [
    {
      "factor": "What affects confidence",
      "direction": "increases|decreases",
      "magnitude": "strong|moderate|weak"
    }
  ],
  "arguments": [
    {
      "addresses": "Opponent claim|New point|Sub-question",
      "reasoning": "The argument",
      "evidence": [
        {
          "type": "data|computation|first_principles|analogy|thought_experiment|expert_consensus|intuition",
          "claim": "Specific claim this supports",
          "source": "Origin (study name, calculation, etc.)",
          "url": "If applicable",
          "rebuttable_by": "What would defeat this"
        }
      ]
    }
  ],
  "agreements": [
    {
      "point": "What you agree with",
      "since_round": 0
    }
  ],
  "disagreements": [
    {
      "point": "What you contest",
      "why": "Reasoning",
      "evidence_needed": "What would change your mind"
    }
  ],
  "position_change": {
    "changed": false,
    "from": "Previous position if changed",
    "to": "New position if changed",
    "trigger": "What evidence/argument caused the shift"
  },
  "user_question": null
}
```

#### Referee Output

```json
{
  "round": 0,
  "status": "CONTINUE|CONSENSUS_REACHED|USER_INPUT_NEEDED|DEADLOCK",
  "state": {
    "debater_a": {
      "position_summary": "...",
      "overall_confidence": 0.00,
      "confidence_trend": "rising|stable|falling"
    },
    "debater_b": {
      "position_summary": "...",
      "overall_confidence": 0.00,
      "confidence_trend": "rising|stable|falling"
    },
    "agreed_points": ["..."],
    "contested_points": ["..."],
    "evidence_quality": {
      "debater_a": "Assessment",
      "debater_b": "Assessment"
    }
  },
  "assessment": "Analysis of round: convergence, engagement quality, logical issues",
  "flags": ["Concerns: weak evidence, fallacies, talking past each other"],
  "user_question": null,
  "consensus_statement": null
}
```

---

### Prompts

#### Debater System Prompt

```
You are a debater in a structured multi-LLM debate. Your goal is to reason toward truth, not to win. Extended thinking is enabled—use it to deeply analyze arguments before responding.

TOOLS (use during your turn, before outputting JSON)
• web_search(query): Find data from reputable sources. Prefer primary sources.
• web_fetch(url): Read full content when snippets insufficient.
• python_exec(code): Compute, simulate, analyze.
• file_write(path, content): Save analysis for later turns.
• file_read(path): Read user-provided files or saved work.

CLAIM SOURCES (ranked by strength)
1. data – Empirical evidence with citation
2. computation – Calculation via python_exec
3. first_principles – Axioms + logical derivation
4. analogy – Similar cases (state mapping explicitly)
5. thought_experiment – Hypothetical (state setup)
6. expert_consensus – Must cite underlying data if challenged
7. intuition – Flag as such; invites challenge

RULES
1. Ground every claim. No unsupported assertions.
2. Do not agree prematurely. Productive disagreement is valuable. Update only when evidence compels—then state what changed your mind.
3. Steel-man before critiquing.
4. Decompose confidence: what makes you more/less certain?

CONFIDENCE SCALE
• 0.95+: Near certain (20:1 odds)
• 0.80–0.94: High (4:1)
• 0.60–0.79: Moderate (2:1)
• 0.40–0.59: Uncertain (~1:1)
• 0.20–0.39: Low (1:2)
• <0.20: Near certain against (1:4+)

OUTPUT FORMAT
Return valid JSON matching the Debater schema. Key fields:
• position.summary + position.sub_positions for complex topics
• arguments[] – each addresses a specific point with evidence
• position_change – if you shifted, say from what, to what, and why
• user_question – only if blocked without user input (otherwise null)
```

#### Referee System Prompt

```
You are the referee in a structured multi-LLM debate. Track state, ensure productive discourse, determine when consensus is reached or user input is needed. Extended thinking enabled.

YOU TRACK
• Each debater's position and confidence over time
• Agreed vs. contested points
• Evidence introduced and quality
• Position stability (converging, diverging, stuck)

EVALUATION CRITERIA
1. Evidence quality – Properly sourced? Strength matches claim importance?
2. Logical validity – Sound arguments? Flag fallacies.
3. Genuine engagement – Addressing actual points? Steel-manning?
4. Intellectual honesty – Position changes cite reasons? Confidence calibrated?

CONSENSUS CRITERIA
Accept when:
• Positions compatible
• Both cite evidence that drove convergence
• Disagreements resolved or scoped as value judgments
• Minimum 3 substantive exchanges

Reject if:
• Capitulation without reasoning
• Core issues glossed over
• <3 rounds without major new evidence

ESCALATE TO USER when:
• Debate hinges on user context/values/constraints
• Empirical dispute unresolvable with tools
• Deadlock 3+ rounds
• Value tradeoffs only user can weigh

OUTPUT FORMAT
Return valid JSON matching the Referee schema. The status field drives orchestrator control flow:
• CONTINUE – next round
• USER_INPUT_NEEDED – pause for user (fill user_question)
• CONSENSUS_REACHED – return result (fill consensus_statement)
• DEADLOCK – escalate to user
```

---

### Orchestrator

```python
@dataclass
class DebateConfig:
    topic: str
    max_rounds: int = 10
    user_files: list[File] = field(default_factory=list)

@dataclass
class DebateResult:
    outcome: str  # "consensus" | "deadlock" | "max_rounds"
    conclusion: str | None
    final_state: dict
    rounds: int
    history: list[dict]

def run_debate(config: DebateConfig) -> DebateResult:
    history = []
    shared_context = {
        "topic": config.topic,
        "user_files": config.user_files,
        "rounds": []
    }
    
    for round_num in range(1, config.max_rounds + 1):
        # Debater A turn (uses tools internally, outputs JSON)
        response_a = debater_a.run(
            context=shared_context,
            history=history,
            extended_thinking=True
        )
        
        # Check if Debater A needs user input
        if response_a.get("user_question"):
            user_input, new_files = prompt_user(response_a["user_question"])
            shared_context["user_files"].extend(new_files)
            history.append({"type": "user_clarification", "content": user_input})
            continue
        
        # Debater B turn (sees A's response)
        response_b = debater_b.run(
            context=shared_context,
            history=history,
            opponent_response=response_a,
            extended_thinking=True
        )
        
        # Check if Debater B needs user input
        if response_b.get("user_question"):
            user_input, new_files = prompt_user(response_b["user_question"])
            shared_context["user_files"].extend(new_files)
            history.append({"type": "user_clarification", "content": user_input})
            continue
        
        # Referee evaluates
        verdict = referee.run(
            response_a=response_a,
            response_b=response_b,
            history=history,
            extended_thinking=True
        )
        
        # Record round
        round_data = {
            "round": round_num,
            "debater_a": response_a,
            "debater_b": response_b,
            "verdict": verdict
        }
        history.append(round_data)
        shared_context["rounds"].append(round_data)
        
        # Handle verdict
        match verdict["status"]:
            case "CONSENSUS_REACHED":
                return DebateResult(
                    outcome="consensus",
                    conclusion=verdict["consensus_statement"],
                    final_state=verdict["state"],
                    rounds=round_num,
                    history=history
                )
            
            case "USER_INPUT_NEEDED" | "DEADLOCK":
                user_input, new_files = prompt_user(
                    verdict["user_question"],
                    state=verdict["state"]
                )
                shared_context["user_files"].extend(new_files)
                history.append({"type": "user_input", "content": user_input})
            
            case "CONTINUE":
                pass
    
    # Max rounds reached
    final_verdict = history[-1]["verdict"]
    return DebateResult(
        outcome="max_rounds",
        conclusion=None,
        final_state=final_verdict["state"],
        rounds=config.max_rounds,
        history=history
    )
```

---

### Debate State Viewer

A UI-layer feature that transforms raw JSON output into clean, user-friendly summaries without burdening debaters or referee with formatting concerns.

#### Design Principle

**Separation of concerns**: Debaters and referee focus solely on truth-seeking. All presentation logic lives in the UI layer, which processes their JSON outputs to create readable views.

#### State Viewer Components

**1. Quick State Summary** (always visible)
- Current round number
- Status badge (Debating | Consensus | User Input Needed | Deadlock)
- Position alignment meter (converging ↔ diverging)
- Evidence count (A: X sources, B: Y sources)

**2. Position Tracker**
```
┌─────────────────────────────────────────────────────┐
│ Debater A                          Debater B        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Position: [summary]                Position: ...    │
│ Confidence: ████████░░ 0.82        Confidence: ...  │
│ Trend: ↗ Rising                    Trend: ...       │
└─────────────────────────────────────────────────────┘
```

**3. Agreement/Disagreement View**
```
✓ Agreed Points (3)
  • Point 1 (since round 2)
  • Point 2 (since round 3)

✗ Contested Points (2)
  • Disagreement description
    - A's view: ...
    - B's view: ...
    - Evidence gap: what's needed to resolve
```

**4. Confidence Evolution Graph**
- Line chart showing both debaters' confidence over rounds
- Annotations for position changes
- Highlights convergence/divergence moments

**5. Evidence Summary Table**
| Round | Debater | Type | Claim | Source | Strength |
|-------|---------|------|-------|--------|----------|
| 3     | A       | data | ...   | [link] | High     |
| 4     | B       | computation | ... | python_exec | High |

**6. Debate Health Metrics**
- Evidence quality score (High/Medium/Low per debater)
- Engagement quality (addressing points vs talking past)
- Logical validity flags from referee
- Round productivity indicator

#### Implementation Details

**Component**: `DebateStateViewer.tsx` (client component)
- Consumes `history[]` from orchestrator
- Pure transformation logic—no LLM calls
- Real-time updates as rounds progress
- Collapsible sections for details
- Export state as markdown summary

**Processing Logic** (example)
```typescript
function computeStateView(history: DebateRound[]): StateView {
  const latestRound = history[history.length - 1];
  const referee = latestRound.verdict;
  
  return {
    round: referee.round,
    status: referee.status,
    positions: {
      a: {
        summary: latestRound.debater_a.position.summary,
        confidence: latestRound.debater_a.overall_confidence,
        trend: computeTrend(history, 'a')
      },
      b: { /* similar */ }
    },
    agreements: referee.state.agreed_points,
    contested: referee.state.contested_points,
    confidenceHistory: extractConfidenceHistory(history),
    evidenceSummary: aggregateEvidence(history)
  };
}
```

**Placement**: 
- Sidebar panel (toggleable) during active debate
- Summary card above debate transcript
- Exportable report after conclusion

#### What This Does NOT Change

- Debater JSON schema: no new fields required
- Referee JSON schema: no new fields required
- Debater/Referee prompts: unchanged
- Orchestrator logic: unchanged (just passes data)

The state viewer is purely a consumer of existing JSON outputs, applying presentation logic that belongs in the UI layer.

---

### Next Features
- bug: when selecting haiku it still says it selects sonnet
- fix browser extension
- debate UI panel fixes and enhancements - 1. expand current position to see full screen 2. fix confidence over time
- optimize speed. Especially at UI level, LLM's must be the bottleneck. It seems right now there are issues at the UI level, for instance the referee waits for a long time to start even after the 2 debaters are done. Potentially make a less thorough prompt to go faster with LLMs too.
- add login - no sign up
- deploy to vercel, remove all secrets from codebase (incl. api key)
- do a 360 security check. No one can access if not logged in, no data is stored, no data can be intercepted
- store debate history in a structured, user friendly way. Thoroughly check horizontal partitioning.
- add more models - Gemini, ChatGPT, DeepSeek, Qwen, Mistral
- N>2 debaters: turn order, coalition dynamics
- Debate trees: branch on sub-questions, merge conclusions
- Confidence calibration tracking: are debaters well-calibrated over time?
- Adversarial mode: assign positions rather than letting debaters choose
- Find a way to add enough entropy for a rich debate
- Cross-debate memory: recall relevant past debates