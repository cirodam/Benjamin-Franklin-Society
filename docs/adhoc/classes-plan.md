# Atheneum Satellite App — Planning Document

A mini community college. Community members propose and teach classes; the community pays both instructor and attending students. Learning is treated as labor that builds collective capacity.

---

## Concepts

### Class
A single session. The atomic unit. Can exist standalone or as part of a Course.

**Fields:**
- `id`, `createdAt`, `updatedAt`
- `courseId: string | null` — parent course, if any
- `title: string`
- `description: string`
- `category: ClassCategory` — see categories below
- `instructorIds: string[]` — handles; creator is always first
- `scheduledAt: string` — ISO 8601
- `durationMinutes: number`
- `location: string` — physical address or "Online"
- `capacity: number | null` — null = unlimited
- `instructorRateKin: number` — total kin paid to all instructors combined per session
- `studentStipendKin: number` — kin paid per attending student per session
- `status: ClassStatus` — `draft | pending-approval | approved | cancelled | completed`
- `approvalMotionId: string | null` — ID of the Teachers pool motion that approved it
- `enrollmentIds: string[]` — enrolled member IDs (up to capacity)
- `attendanceLog: AttendanceRecord[]` — recorded at session close (attended or absent)

### Course
An ordered container of classes — a multi-session curriculum.

**Fields:**
- `id`, `createdAt`, `updatedAt`
- `title: string`
- `description: string`
- `category: ClassCategory`
- `instructorIds: string[]`
- `prerequisites: string` — free text (e.g. "Basic First Aid course" or "none")
- `classIds: string[]` — ordered
- `status: CourseStatus` — `draft | active | completed | cancelled`

Enrolling in a course auto-enrolls in all its classes (unless already at capacity). Members can also drop-in to individual classes within a course if capacity allows, without full course enrollment.

### Class Request
A community member's request for a class that doesn't exist yet. No budget, no approval required — just a signal of demand.

**Fields:**
- `id`, `createdAt`
- `requesterId: string`
- `requesterHandle: string`
- `title: string`
- `description: string` — what they want to learn and why
- `upvoteIds: string[]` — member IDs who've upvoted
- `claimedBy: string | null` — instructor handle who picked it up
- `classId: string | null` — the class created from this request

### Attendance Record
```
{ memberId: string; attended: boolean; recordedAt: string }
```
Full stipend for attended; zero for absent. No minute-tracking.

---

## Categories
`practical-skills | health-wellness | arts-culture | civic-governance | languages | trades | agriculture | other`

---

## Approval Flow

1. **Instructor drafts a class** (or course). Specifies rate, student stipend, capacity, schedule.
2. System calculates **budget estimate**: `instructorRateKin + (studentStipendKin × capacity)` per session, summed across all sessions.
3. **Instructor submits for approval** → creates a motion in the Teachers leader pool with the budget embedded in the payload.
4. **Teachers pool votes** (standard pool-general vote rule: simple majority). They can discuss, push back, or negotiate rate before approving.
5. On approval: class status → `approved`. Community treasury **reserves the budget**.
6. Classes in `draft` or `pending-approval` are visible but not enrollable.

**Cancellation:**
- If cancelled before running: full reserved budget returns to treasury, enrolled students notified.
- If cancelled mid-course: budget for completed sessions already paid out; remaining reserved budget returns.

---

## Payment Flow (post-session)

After each session the instructor closes it and submits an attendance log (who attended and for how many minutes):

1. Each attending student receives `studentStipendKin` from treasury.
2. Instructor(s) split `instructorRateKin` according to their defined percentages.
3. Any unspent student budget (no-shows) returns to treasury.
4. Session marked `completed`.

Payment is triggered server-side by the `POST /sessions/:id/complete` endpoint. The bank transfer calls are made from the atheneum app → bank API, same pattern as existing satellite apps.

---

## Enrollment

- First-come-first-served up to `capacity`.
- `null` capacity = unlimited.
- Members can enroll/drop-out while status is `approved` and session hasn't started.
- Dropping out after session starts: no stipend. Dropping out before: frees their slot.
- No-shows: marked absent → 0 stipend → slot budget returns to treasury.

---

## Data Model (SQLite)

Three tables in `atheneum.db`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_requests (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
```

JSON blob storage, same pattern as market app.

---

## API Routes

### Sessions
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/sessions` | public | List sessions (filter: status, category, instructorHandle, courseId) |
| GET | `/sessions/:id` | public | Get session detail |
| POST | `/sessions` | member | Create session draft |
| PATCH | `/sessions/:id` | instructor | Edit draft |
| POST | `/sessions/:id/submit` | instructor | Submit for Teachers pool approval |
| POST | `/sessions/:id/enroll` | member | Enroll self |
| DELETE | `/sessions/:id/enroll` | member | Drop out |
| POST | `/sessions/:id/complete` | instructor | Close session, submit attendance log |
| DELETE | `/sessions/:id` | instructor | Cancel (instructor) or steward |

### Courses
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/courses` | public | List courses |
| GET | `/courses/:id` | public | Get course detail |
| POST | `/courses` | member | Create course |
| PATCH | `/courses/:id` | instructor | Edit |
| POST | `/courses/:id/enroll` | member | Enroll in all sessions |

### Class Requests
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/class-requests` | public | List requests (sorted by upvotes) |
| POST | `/class-requests` | member | Submit a request |
| POST | `/class-requests/:id/upvote` | member | Upvote |
| DELETE | `/class-requests/:id/upvote` | member | Remove upvote |
| POST | `/class-requests/:id/claim` | member | Claim as instructor (links to sessionId) |

---

## Frontend Pages

- **AtheneumPage** — browse approved/upcoming sessions and courses. Tabs: Upcoming / My Enrollments / All.
- **SessionDetailPage** — full session detail, enroll button, attendance (for instructor).
- **CoursePage** — course overview with session list.
- **CreateSessionPage** — draft form for new session or course.
- **RequestsPage** — community request board, sorted by upvotes. Upvote, claim, post new request.
- **MySessionsPage** — sessions you're teaching. Manage attendance, complete sessions.

---

## Package Structure

```
packages/atheneum/
  Dockerfile
  package.json
  tsconfig.json
  src/
    AtheneumDb.ts
    Session.ts
    SessionLoader.ts
    SessionService.ts
    Course.ts
    CourseLoader.ts
    CourseService.ts
    ClassRequest.ts
    ClassRequestLoader.ts
    ClassRequestService.ts
    communityIdentity.ts
    index.ts
    routes/
      atheneumRoutes.ts
      SessionController.ts
      CourseController.ts
      ClassRequestController.ts
  frontend/
    index.html
    package.json
    vite.config.ts
    src/
      App.svelte
      main.ts
      lib/
        api.ts
        auth.ts
      pages/
        AtheneumPage.svelte
        SessionDetailPage.svelte
        CoursePage.svelte
        CreateSessionPage.svelte
        RequestsPage.svelte
        MySessionsPage.svelte
```

---

## Open Questions

- **Instructor split for co-taught classes:** Custom percentages defined at creation time (must sum to 100). Stored as `instructorSplits: { handle: string; pct: number }[]`.
- **Course-level budget approval:** Approve the whole course at once. Budget estimate = `(instructorRateKin + studentStipendKin × capacity) × classIds.length`. Individual class sessions inherit the course approval; no separate motion per session.
- **Guest instructors:** For now, instructors must be community members. Future: allow external instructors without pay access to bank?
- **Port:** Market is 3003. Atheneum would be 3004 (check for conflicts with other planned apps).
