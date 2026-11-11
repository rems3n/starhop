/** Practice: quizzes, review and the progress dashboard, mounted at /practice/*. See docs/QUIZ.md. */
import { Navigate, Route, Routes } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { Dashboard } from './Dashboard';
import { FindPage, Hub, KnowledgePage, LessonQuizPage, ModuleQuizPage, NamePage, ObjectPage, ReviewPage, StarhopPage, StoryPage, VisibilityPage, WeakestPage } from './pages';
import './quiz.css';

/** Nested under /practice/*. With `progressOnly` only the dashboard is rendered (legacy /progress mount). */
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
      <Route path="starhop" element={<StarhopPage />} />
      <Route path="lesson/:id" element={<LessonQuizPage />} />
      <Route path="module/:id" element={<ModuleQuizPage />} />
      <Route path="review" element={<ReviewPage />} />
      <Route path="weakest" element={<WeakestPage />} />
      <Route path="progress" element={<Dashboard />} />
      <Route path="*" element={<Navigate to={routes.practice()} replace />} />
    </Routes>
  );
}
