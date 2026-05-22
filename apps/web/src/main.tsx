import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { createQueryClient } from './lib/query-client';
import { AppShell } from './routes/AppShell';
import { BoardPage } from './routes/BoardPage';
import { LoginPage } from './routes/LoginPage';
import { NotFound } from './routes/NotFound';
import { ProjectLayout } from './routes/ProjectLayout';
import { ProjectsPage } from './routes/ProjectsPage';
import { RegisterPage } from './routes/RegisterPage';
import { TreePage } from './routes/TreePage';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const queryClient = createQueryClient();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<ProjectsPage />} />
                  <Route path="projects/:projectId" element={<ProjectLayout />}>
                    <Route index element={<BoardPage />} />
                    <Route path="tree" element={<TreePage />} />
                  </Route>
                  <Route path="starred" element={<Navigate to="/" replace />} />
                  <Route path="people" element={<Navigate to="/" replace />} />
                  <Route path="settings" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </DndProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
