-- O que o up apagou não volta: as respostas antigas (escolhas) e os badges
-- l e v22 gravados (user_badges) não ficam guardados em lugar nenhum. Quem
-- precisar do estado anterior restaura de backup do banco. Aqui só sobra
-- limpar o que a enquete nova gravou, para a pergunta voltar como estava
-- antes dela.
DELETE FROM escolhas WHERE enquete = 'segundo-turno';
DELETE FROM user_badges WHERE category IN ('l', 'v22', 'nulo');
