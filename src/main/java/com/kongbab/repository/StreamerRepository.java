package com.kongbab.repository;

import com.kongbab.domain.Streamer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StreamerRepository extends JpaRepository<Streamer, Long> {
    Optional<Streamer> findByCustomId(String customId);
    List<Streamer> findAllByOrderByDisplayOrderAscIdAsc();
    List<Streamer> findByCategoryOrderByDisplayOrderAscIdAsc(String category);
    void deleteByCustomId(String customId);
}
