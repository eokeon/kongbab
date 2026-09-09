package com.kongbab.repository;

import com.kongbab.domain.Streamer;
import com.kongbab.domain.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    Optional<Video> findByCustomId(String customId);
    void deleteByCustomId(String customId);
    List<Video> findByStreamerOrderByDisplayOrderAscIdAsc(Streamer streamer);
}
