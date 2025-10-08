# StudyHive - Complete Testing Checklist

## Setup
1. Open the project in your browser (run `npm run dev` if using Vite)
2. Open browser console (Option + Command + J on Mac) to check for errors

---

## 1. THEME SYSTEM ✓
- [ ] Page loads in light theme by default
- [ ] Click profile button → Settings
- [ ] Toggle to dark mode - entire app should change colors
- [ ] Refresh page - dark mode should persist
- [ ] Toggle back to light mode - should persist after refresh

---

## 2. POMODORO TIMER ✓
- [ ] Go to Focus Timer page
- [ ] Click "Start Pomodoro" - timer should count down from 25:00
- [ ] Timer should display correctly (24:59, 24:58, etc.)
- [ ] Click "Pause" - timer should pause
- [ ] Click "Resume" - timer should continue
- [ ] Click "Skip" - should reset timer
- [ ] Start timer and let it run to 0:00 (or skip to end)
- [ ] Check History page - completed session should appear

---

## 3. COURSES MANAGEMENT ✓
### Create Course
- [ ] Go to Courses page
- [ ] Fill out form:
  - Course Name: "Introduction to Biology"
  - Course Code: "BIO 101"
  - Instructor: "Dr. Smith"
  - Term: "Fall 2024"
  - Context: "Study of living organisms and their interactions"
  - Topics: "Cell Biology\nGenetics\nEvolution\nEcology"
- [ ] Click "Create Course"
- [ ] Success message appears
- [ ] Course card appears with all information
- [ ] Topics appear as separate tags

### Edit Course
- [ ] Click edit (✏️) button on course
- [ ] Form should populate with existing data
- [ ] Change Course Name to "Advanced Biology"
- [ ] Click "Update Course"
- [ ] Course card should update with new name

### Delete Course
- [ ] Create a second test course (name it "Test Course")
- [ ] Click delete (🗑️) button
- [ ] Confirm deletion in popup
- [ ] Course should disappear from list

---

## 4. NOTES MANAGEMENT ✓
### Create Note
- [ ] Go to Notes page
- [ ] If course dropdown is empty, go back to Courses and create at least one course first
- [ ] Fill out note form:
  - Title: "Photosynthesis Process"
  - Course: Select "Introduction to Biology" (or your course)
  - Content: "Photosynthesis is the process by which plants convert light energy into chemical energy. The equation is: 6CO2 + 6H2O + light → C6H12O6 + 6O2"
- [ ] Click "Create Note"
- [ ] Success message appears
- [ ] Note card appears with title, course badge, and date

### Test Long Notes (Expand/Collapse)
- [ ] Create a second note with content longer than 300 characters (copy sample below)
- [ ] Note should show preview with "..." and "Show more ▼" button
- [ ] Click "Show more ▼" - full content should appear
- [ ] Click "Show less ▲" - should collapse back to preview

**Sample long note content:**
```
Cellular respiration is the process by which cells break down glucose to produce ATP. It occurs in three stages: glycolysis (in the cytoplasm), the Krebs cycle (in the mitochondrial matrix), and the electron transport chain (in the inner mitochondrial membrane). Glycolysis breaks down one glucose molecule into two pyruvate molecules, producing 2 ATP and 2 NADH. The Krebs cycle processes pyruvate to produce CO2, ATP, NADH, and FADH2. Finally, the electron transport chain uses NADH and FADH2 to create a proton gradient that drives ATP synthesis, producing approximately 34 ATP molecules.
```

### Copy Note
- [ ] Click copy (📋) button on any note
- [ ] Success message "Note copied to clipboard" appears
- [ ] Paste (Command + V) in a text editor - note content should paste

### Use Note for Quiz
- [ ] Click the robot (🤖) button on your Photosynthesis note
- [ ] Should redirect to Quizzes page
- [ ] Quiz notes textarea should auto-fill with the note content
- [ ] Green success message should appear with note title

### Edit Note
- [ ] Go back to Notes page
- [ ] Click edit (✏️) button on a note
- [ ] Form should populate with note data
- [ ] Change title to "Photosynthesis Overview"
- [ ] Click "Update Note"
- [ ] Note card should update

### Filter by Course
- [ ] Create notes for multiple courses (if you haven't already)
- [ ] Use the "Filter by Course" dropdown
- [ ] Select a specific course
- [ ] Only notes for that course should display
- [ ] Select "All Courses" - all notes should reappear

### Delete Note
- [ ] Click delete (🗑️) button on a note
- [ ] Confirm deletion
- [ ] Note should disappear

---

## 5. AI QUIZ GENERATION ✓
### Initial Setup (if not done)
- [ ] Go to Quizzes page
- [ ] Scroll to "AI Diagnostics" section
- [ ] Click "1. Download AI Model" - should download (may take a few minutes)
- [ ] When complete, click "2. Initialize AI" - status should show "ready: true"

### Generate AI Quiz
- [ ] Clear the notes text area if it has content
- [ ] Paste this sample content:
```
Photosynthesis is the process by which plants convert light energy into chemical energy.

Key Components:
- Chloroplasts: Organelles where photosynthesis occurs
- Chlorophyll: Green pigment that captures light
- Light-dependent reactions: Occur in thylakoid membranes
- Light-independent reactions (Calvin cycle): Occur in stroma

Chemical Equation:
6CO2 + 6H2O + light energy → C6H12O6 + 6O2

Products: Glucose (C6H12O6) and Oxygen (O2)
```
- [ ] Number of questions: 3
- [ ] Select "LLM" as quiz type
- [ ] Click "Generate Quiz"
- [ ] Wait for generation (may take 30-60 seconds)
- [ ] Quiz should generate with 3 questions about photosynthesis

### Take Quiz
- [ ] Answer each question (mix of correct and incorrect answers)
- [ ] Click "Next" between questions
- [ ] On last question, "Finish Quiz" button should appear
- [ ] Click "Finish Quiz"
- [ ] Results should display with score and AI feedback
- [ ] Check History page - quiz should be saved

### Test Rules Engine (Fallback)
- [ ] Generate a new quiz using "Rules Engine" type
- [ ] Should generate instantly (no AI delay)
- [ ] Questions should be simpler/more generic
- [ ] Complete quiz and verify it works

---

## 6. CHEATSHEETS GENERATION ✓
### Generate Cheatsheet
- [ ] Go to Cheat Sheets page
- [ ] Ensure you have:
  - At least one course created
  - At least one note linked to that course
- [ ] Fill out form:
  - Title: "Biology Unit 1 Summary"
  - Course: Select "Introduction to Biology"
  - Check all boxes: Include course context, topics, and notes
- [ ] Click "Generate cheat sheet"
- [ ] Success message appears
- [ ] Cheatsheet card appears with preview

### View Full Cheatsheet
- [ ] Click view (👁️) button
- [ ] Modal should open with full formatted content
- [ ] Should show:
  - Course name as header
  - Course code, instructor, term
  - "Course Context" section
  - "Key Topics" as bullet list
  - "Notes" section with each note
- [ ] Click X or click outside modal to close

### Print Cheatsheet
- [ ] Click print (🖨️) button
- [ ] New window should open with formatted content
- [ ] Print dialog should appear
- [ ] Close print dialog and window

### Copy Cheatsheet
- [ ] Click copy (📋) button
- [ ] Success message appears
- [ ] Paste in text editor - full cheatsheet should paste

### Test Different Options
- [ ] Generate another cheatsheet
- [ ] Uncheck "Include course context"
- [ ] Generate
- [ ] View - should NOT have context section

### Delete Cheatsheet
- [ ] Click delete (🗑️) button
- [ ] Confirm deletion
- [ ] Cheatsheet should disappear

---

## 7. INTEGRATION TESTS ✓
### Full Workflow Test
- [ ] Create a new course: "Physics 101"
- [ ] Create 2 notes for Physics 101 about different topics
- [ ] Click 🤖 button on first note to use for quiz
- [ ] Generate AI quiz from that note (2 questions)
- [ ] Complete the quiz
- [ ] Go to Cheat Sheets
- [ ] Generate cheatsheet for Physics 101 with all options checked
- [ ] View cheatsheet - should contain both notes
- [ ] Go to History - quiz should be recorded

---

## 8. DATA PERSISTENCE ✓
- [ ] Create a course, note, and cheatsheet
- [ ] Completely close browser
- [ ] Reopen and navigate to the app
- [ ] Go to Courses - course should still be there
- [ ] Go to Notes - note should still be there
- [ ] Go to Cheat Sheets - cheatsheet should still be there
- [ ] Check History - past sessions should still be there

---

## 9. ERROR HANDLING ✓
### Form Validation
- [ ] Courses: Try to create course without name - should show error
- [ ] Notes: Try to create note without title - should show error
- [ ] Cheatsheets: Try to generate without selecting course - should show error

### Edge Cases
- [ ] Try to generate cheatsheet for course with no notes - should still work (just no notes section)
- [ ] Try to filter notes by course when no notes exist - should show "No notes yet"
- [ ] Try to edit/delete non-existent items - should handle gracefully

---

## 10. CONSOLE CHECK ✓
- [ ] Open browser console throughout testing
- [ ] Should NOT see any red errors (except normal warnings are OK)
- [ ] Look for JavaScript errors, 404s, or failed network requests

---

## Completion Checklist
- [ ] All 10 sections tested
- [ ] No blocking errors found
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] AI quiz generation works
- [ ] Data persists across sessions
- [ ] Theme switching works

---

## If You Find Issues
1. Note the exact steps to reproduce
2. Check browser console for error messages
3. Take screenshots if visual issues
4. Test in different browser if possible

---

**Expected Result:** All features should work smoothly with no errors. The app should feel cohesive with all systems integrating together (courses → notes → quizzes/cheatsheets).
