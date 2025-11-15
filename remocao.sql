-- Templates de DELETE para remoção individual de dados
-- Use estes comandos como base para implementar funções de deleção no server.ts
-- Ordem: começar pelas tabelas filhas para evitar violações de chaves estrangeiras

-- Deletar estudante por ID
-- DELETE FROM estudante WHERE id_estudante = :id;

-- Deletar componente_nota por ID
-- DELETE FROM componente_nota WHERE id_componente_nota = :id;

-- Deletar turma por ID (cascade para estudante, media, auditoria)
-- DELETE FROM turma WHERE id_turma = :id;

-- Deletar disciplina por ID (cascade para turma, rel)
-- DELETE FROM disciplina WHERE id_disciplina = :id;

-- Deletar relação curso-disciplina
-- DELETE FROM rel WHERE id_curso = :id_curso AND id_disciplina = :id_disciplina;

-- Deletar curso por ID (cascade para rel)
-- DELETE FROM curso WHERE id_curso = :id;

-- Deletar instituição por ID (cascade para curso)
-- DELETE FROM instituicao WHERE id_instituicao = :id;

-- Deletar usuário por ID (cascade para instituicao)
-- DELETE FROM usuario WHERE id_usuario = :id;

-- Deletar auditoria por ID (se necessário, mas trigger pode recriar)
-- DELETE FROM auditoria WHERE id_auditoria = :id;

-- Deletar media por combinação de IDs
-- DELETE FROM media WHERE id_estudante = :id_estudante AND id_componente_nota = :id_componente_nota AND id_auditoria = :id_auditoria;

-- Após cada DELETE, execute:
-- COMMIT;
