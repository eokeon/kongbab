package com.kongbap.repository;

import com.kongbap.domain.UserWatchRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserWatchRecordRepository extends JpaRepository<UserWatchRecord, Long> {
    List<UserWatchRecord> findByUsername(String username);
    List<UserWatchRecord> findByUsernameAndWatchedTrue(String username);
    Optional<UserWatchRecord> findByUsernameAndStreamerIdAndVideoType(String username, String streamerId, String videoType);
    void deleteByUsernameAndStreamerIdAndVideoType(String username, String streamerId, String videoType);
}
