
-- Apagar todos os dados de simulados em ordem de dependência (FKs)
DELETE FROM error_notebook;
DELETE FROM attempt_processing_queue;
DELETE FROM user_performance_history;
DELETE FROM user_performance_summary;
DELETE FROM attempt_question_results;
DELETE FROM answers;
DELETE FROM attempts;
DELETE FROM question_options;
DELETE FROM questions;
DELETE FROM simulados;
