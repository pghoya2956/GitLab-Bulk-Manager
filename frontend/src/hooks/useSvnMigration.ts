import { useState, useCallback } from 'react';
import { gitlabService } from '../services/gitlab';
import { useNotification } from './useNotification';

export const useSvnMigration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  const testConnection = useCallback(async (data: {
    svnUrl: string;
    svnUsername: string;
    svnPassword: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.testSvnConnection(data);
      showSuccess('SVN 연결 성공');
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'SVN 연결 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const extractUsers = useCallback(async (svnUrl: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.extractSvnUsers(svnUrl);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '사용자 추출 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const previewMigration = useCallback(async (data: {
    svnUrl: string;
    layout: any;
    authorsMapping: Record<string, string>;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.previewSvnMigration(data);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '미리보기 생성 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const startMigration = useCallback(async (data: {
    svnUrl: string;
    gitlabProjectId: number;
    projectName: string;
    projectPath: string;
    layout: any;
    authorsMapping: Record<string, string>;
    options?: any;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.startSvnMigration(data);
      showSuccess('마이그레이션이 시작되었습니다', 'success');
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '마이그레이션 시작 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const startBulkMigration = useCallback(async (migrations: any[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.startBulkSvnMigration(migrations);
      showSuccess('대량 마이그레이션이 시작되었습니다', 'success');
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '대량 마이그레이션 시작 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const getMigrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.getSvnMigrations();
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '마이그레이션 목록 조회 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const getMigrationById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.getSvnMigrationById(id);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '마이그레이션 조회 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const syncMigration = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.syncSvnMigration(id);
      showSuccess('증분 동기화가 시작되었습니다', 'success');
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '동기화 시작 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const deleteMigration = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await gitlabService.deleteSvnMigration(id);
      showSuccess('마이그레이션이 삭제되었습니다', 'success');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || '마이그레이션 삭제 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const parseSvnYaml = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gitlabService.parseSvnYaml(content);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'YAML 파싱 실패';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  return {
    isLoading,
    error,
    testConnection,
    extractUsers,
    previewMigration,
    startMigration,
    startBulkMigration,
    getMigrations,
    getMigrationById,
    syncMigration,
    deleteMigration,
    parseSvnYaml,
  };
};