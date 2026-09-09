-- ============================================================
-- Prospección — sello de escaneado
-- 2026-09-09
-- ============================================================
--
-- El síntoma: apretar "Escanear 20 sin escanear" no cambiaba nada. Se volvía a
-- apretar y salían los mismos veinte, para siempre.
--
-- Eran dos problemas encadenados y este es el segundo.
--
--  1. La pantalla tiraba el resultado del escaneo cuando no había señales de
--     dolor nuevas, y con él tiraba el teléfono, el Instagram y el mail, que
--     viajan en otro campo. Eso se arregló en el cliente.
--
--  2. Aun arreglando lo anterior, no había forma de distinguir "todavía no lo
--     escaneé" de "lo escaneé y no había nada que traer". Los dos casos se ven
--     igual desde afuera —sin teléfono, sin Instagram— así que un prospecto sin
--     datos que encontrar volvía al bloque de pendientes en cada corrida y el
--     botón nunca terminaba de vaciarse.
--
-- Este sello resuelve el segundo: se escribe en cada corrida, encuentre o no
-- encuentre algo, y también cuando el escaneo falla. Un prospecto ya escaneado
-- que sigue sin canal deja de figurar como tarea pendiente y pasa a decir lo
-- que realmente es: no hay por dónde entrar, o hay que abrirlo a mano.

ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS escaneado_at TIMESTAMPTZ;

COMMENT ON COLUMN prospectos.escaneado_at IS
  'Última corrida del escaneo automático, haya encontrado algo o no. NULL = nunca se escaneó.';

-- El bloque de "sin escanear" de la cola del día es exactamente esta consulta.
CREATE INDEX IF NOT EXISTS idx_prospectos_sin_escanear
  ON prospectos (sistema)
  WHERE escaneado_at IS NULL;
