-- Reset da enquete do segundo turno (internal/enquete). A pergunta mudou
-- (agora são L, 22 e Nulo, sem "Prefiro não dizer"), então todo mundo escolhe
-- de novo:
--   - apaga TODAS as respostas da enquete "segundo-turno" em escolhas (l, 22 e
--     nenhum). O corte não muda (contas criadas antes de 26/10/2026 00:00 em
--     Brasília), então a pergunta volta para todos os elegíveis;
--   - apaga os tiers gravados dos badges l e v22 em user_badges (único lugar
--     onde o tier fica gravado) e, por segurança, os do novo badge nulo. Os
--     badges voltam a ser concedidos, com aviso, só quando a pessoa responder.
-- Nenhum aviso de desbloqueio sai daqui: é só limpeza.
DELETE FROM escolhas WHERE enquete = 'segundo-turno';
DELETE FROM user_badges WHERE category IN ('l', 'v22', 'nulo');
