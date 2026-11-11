/** Mode 3: quizzes and the progress dashboard. See docs/QUIZ.md. */
import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { FindPage, Hub, KnowledgePage, LessonQuizPage, NamePage, ObjectPage, ReviewPage, StoryPage, UnitQuizPage, VisibilityPage, WeakestPage } from './pages';
import './quiz.css';

/** Nested under /quiz/*. With `progressOnly` (route /progress) only the dashboard is rendered. */
export default function QuizRoutes({ progressOnly }: { progressOnly?: boolean }) {
  if (progressOnly) return <Dashboard />;
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path="find" element={<FindPage />} />
      <Route path="name" element={<NamePage />} />
      <Route path="object" element={<ObjectPage />} />
      <Route path="story" element={<StoryPage />} />
      <Route path="knowledge" element={<KnowledgePage />} />
      <Route path="visibility" element={<VisibilityPage />} />
      <Route path="lesson/:id" element={<LessonQuizPage />} />
      <Route path="unit/:id" element={<UnitQuizPage />} />
      <Route path="review" element={<ReviewPage />} />
      <Route path="weakest" element={<WeakestPage />} />
      <Route path="progress" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/quiz" replace />} />
    </Routes>
  );
}
