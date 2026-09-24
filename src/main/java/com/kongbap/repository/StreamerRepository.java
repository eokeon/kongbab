package com.kongbap.repository;

import com.kongbap.domain.Streamer;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StreamerRepository extends JpaRepository<Streamer, Long> {
    @EntityGraph(attributePaths = {"videos"})
    Optional<Streamer> findByCustomId(String customId);

    @Override
    @EntityGraph(attributePaths = {"videos"})
    Optional<Streamer> findById(Long id);

    @EntityGraph(attributePaths = {"videos"})
    List<Streamer> findAllByOrderByDisplayOrderAscIdAsc();

    @EntityGraph(attributePaths = {"videos"})
    List<Streamer> findByCategoryOrderByDisplayOrderAscIdAsc(String category);

    void deleteByCustomId(String customId);
}
