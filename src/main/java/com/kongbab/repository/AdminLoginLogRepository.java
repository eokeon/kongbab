package com.kongbab.repository;

import com.kongbab.domain.AdminLoginLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminLoginLogRepository extends JpaRepository<AdminLoginLog, Long> {
    List<AdminLoginLog> findTop20ByOrderByLoginTimeDesc();
}
