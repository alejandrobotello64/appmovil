-- Catálogo completo de checklists / pruebas por familia de equipo MAS.
-- Conserva plantillas personalizadas existentes y completa las faltantes.

-- ---------------------------------------------------------------------------
-- 1) Corregir familia de plantillas ya cargadas
-- ---------------------------------------------------------------------------
update public.service_checklist_templates
set equipment_kind = 'monitor',
    name = 'Monitor de signos vitales',
    description = coalesce(nullif(description, ''), 'Checklist físico y de accesorios de monitor multiparámetro')
where code = 'monitor_de_signos_vitales';

update public.service_checklist_templates
set equipment_kind = 'monitor',
    name = 'Pruebas · Monitor de signos vitales',
    description = coalesce(nullif(description, ''), 'Pruebas con simulador / paciente de referencia')
where code = 'pruebas_monitor_de_signos_vitales';

update public.service_checklist_templates
set equipment_kind = 'anestesia',
    name = 'Máquina de anestesia',
    description = coalesce(nullif(description, ''), 'Checklist Atlan / Fabius y estaciones de anestesia')
where code = 'maquina_de_anestesia';

update public.service_checklist_templates
set equipment_kind = 'anestesia',
    name = 'Pruebas · Máquina de anestesia',
    description = coalesce(nullif(description, ''), 'Pruebas ventilatorias y de gases en estación de anestesia')
where code = 'prueba_maquina_anestesia';

update public.service_checklist_templates
set equipment_kind = 'vaporizador',
    name = 'Vaporizador',
    description = coalesce(nullif(description, ''), 'Checklist Vapor 2000 / D-Vapor / módulos de agente')
where code = 'vaporizador';

update public.service_checklist_templates
set equipment_kind = 'cama',
    name = 'Cama de parto Affinity 4',
    description = coalesce(nullif(description, ''), 'Checklist Hill-Rom Affinity 4 / P3700')
where code = 'cama_de_parto_affinity_4';

update public.service_checklist_templates
set equipment_kind = 'cama',
    name = 'Camilla P8040',
    description = coalesce(nullif(description, ''), 'Checklist camilla radiotransparente Hill-Rom P8040')
where code = 'camilla_8040';

update public.service_checklist_templates
set equipment_kind = 'general',
    name = 'Equipos médicos en general',
    description = coalesce(nullif(description, ''), 'Revisión general de ingreso / entrega')
where code = 'general';

-- ---------------------------------------------------------------------------
-- 2) Upsert plantillas (verificación + funcionamiento)
-- ---------------------------------------------------------------------------
insert into public.service_checklist_templates (
  code, name, equipment_kind, description, list_kind, is_active
)
values
  -- Verificación
  ('general', 'Equipos médicos en general', 'general', 'Revisión general de ingreso / entrega', 'verificacion', true),
  ('monitor_de_signos_vitales', 'Monitor de signos vitales', 'monitor', 'Checklist físico y de accesorios de monitor multiparámetro', 'verificacion', true),
  ('fetal', 'Monitor fetal', 'fetal', 'Checklist Avalon FM20/FM30 y monitores fetales', 'verificacion', true),
  ('ventilador', 'Ventilador mecánico', 'ventilador', 'Checklist Evita / Babylog y ventiladores pulmonares', 'verificacion', true),
  ('maquina_de_anestesia', 'Máquina de anestesia', 'anestesia', 'Checklist Atlan / Fabius y estaciones de anestesia', 'verificacion', true),
  ('vaporizador', 'Vaporizador', 'vaporizador', 'Checklist Vapor 2000 / D-Vapor / módulos de agente', 'verificacion', true),
  ('desfibrilador', 'Desfibrilador / DEA', 'desfibrilador', 'Checklist desfibrilador Efficia DFM100 y similares', 'verificacion', true),
  ('bomba_infusion', 'Bomba de infusión', 'bomba_infusion', 'Checklist Infusomat / Perfusor y bombas de jeringa', 'verificacion', true),
  ('autoclave', 'Autoclave / esterilización', 'autoclave', 'Checklist STERRAD / autoclaves de plasma o vapor', 'verificacion', true),
  ('ecg', 'Electrocardiógrafo', 'ecg', 'Checklist ECG de reposo / esfuerzo', 'verificacion', true),
  ('imagen', 'Equipo de imagenología', 'imagen', 'Checklist general de imagen', 'verificacion', true),
  ('cama_hospitalaria', 'Cama / camilla hospitalaria', 'cama', 'Checklist camas clínicas, UCI y camillas de traslado', 'verificacion', true),
  ('cama_de_parto_affinity_4', 'Cama de parto Affinity 4', 'cama', 'Checklist Hill-Rom Affinity 4 / P3700', 'verificacion', true),
  ('camilla_8040', 'Camilla P8040', 'cama', 'Checklist camilla radiotransparente Hill-Rom P8040', 'verificacion', true),
  ('mesa_quirurgica', 'Mesa quirúrgica', 'mesa_quirurgica', 'Checklist mesa de cirugía PST500 y similares', 'verificacion', true),
  ('lampara', 'Lámpara quirúrgica', 'lampara', 'Checklist Polaris y lámparas de quirófano', 'verificacion', true),
  ('alto_flujo', 'Alto flujo / humidificación', 'alto_flujo', 'Checklist Airvo 2 / MR850 y sistemas de humidificación', 'verificacion', true),
  ('calentamiento', 'Calentamiento de paciente', 'calentamiento', 'Checklist Bair Hugger y unidades de aire caliente', 'verificacion', true),
  ('incubadora', 'Incubadora / cuna radiante', 'incubadora', 'Checklist incubadora híbrida / cuna radiante', 'verificacion', true),
  ('antropometria', 'Antropometría / esfigmomanómetro', 'antropometria', 'Checklist básculas, estaciones seca y esfigmomanómetros', 'verificacion', true),
  ('electrocirugia', 'Unidad de electrocirugía', 'electrocirugia', 'Checklist generador electroquirúrgico', 'verificacion', true),

  -- Funcionamiento
  ('pruebas_funcionamiento_general', 'Pruebas · Funcionamiento general', 'general', 'Pruebas operativas al concluir el servicio', 'funcionamiento', true),
  ('pruebas_monitor_de_signos_vitales', 'Pruebas · Monitor de signos vitales', 'monitor', 'Pruebas con simulador / paciente de referencia', 'funcionamiento', true),
  ('pruebas_fetal', 'Pruebas · Monitor fetal', 'fetal', 'Pruebas de detección y alarmas fetales', 'funcionamiento', true),
  ('pruebas_ventilador', 'Pruebas · Ventilador mecánico', 'ventilador', 'Pruebas de volumen, presión y FiO2', 'funcionamiento', true),
  ('prueba_maquina_anestesia', 'Pruebas · Máquina de anestesia', 'anestesia', 'Pruebas ventilatorias y de gases en estación de anestesia', 'funcionamiento', true),
  ('pruebas_vaporizador', 'Pruebas · Vaporizador', 'vaporizador', 'Pruebas de concentración y fugas de agente', 'funcionamiento', true),
  ('pruebas_desfibrilador', 'Pruebas · Desfibrilador', 'desfibrilador', 'Pruebas de energía, carga y auto-test', 'funcionamiento', true),
  ('pruebas_bomba_infusion', 'Pruebas · Bomba de infusión', 'bomba_infusion', 'Pruebas de caudal, oclusión y detector de aire', 'funcionamiento', true),
  ('pruebas_autoclave', 'Pruebas · Autoclave / esterilización', 'autoclave', 'Pruebas de ciclo, temperatura y registro', 'funcionamiento', true),
  ('pruebas_ecg', 'Pruebas · Electrocardiógrafo', 'ecg', 'Pruebas de trazo, calibración 1 mV y filtros', 'funcionamiento', true),
  ('pruebas_imagen', 'Pruebas · Imagenología', 'imagen', 'Pruebas generales de imagen y seguridad', 'funcionamiento', true),
  ('pruebas_cama_hospitalaria', 'Pruebas · Cama / camilla', 'cama', 'Pruebas de movimiento, frenos y CPR', 'funcionamiento', true),
  ('pruebas_cama_parto_affinity_4', 'Pruebas · Affinity 4', 'cama', 'Pruebas funcionales de cama de parto Affinity 4', 'funcionamiento', true),
  ('pruebas_camilla_8040', 'Pruebas · Camilla P8040', 'cama', 'Pruebas funcionales de camilla P8040', 'funcionamiento', true),
  ('pruebas_mesa_quirurgica', 'Pruebas · Mesa quirúrgica', 'mesa_quirurgica', 'Pruebas de posiciones y frenos de mesa', 'funcionamiento', true),
  ('pruebas_lampara', 'Pruebas · Lámpara quirúrgica', 'lampara', 'Pruebas de iluminación, enfoque y respaldo', 'funcionamiento', true),
  ('pruebas_alto_flujo', 'Pruebas · Alto flujo / humidificación', 'alto_flujo', 'Pruebas de flujo, temperatura y humedad', 'funcionamiento', true),
  ('pruebas_calentamiento', 'Pruebas · Calentamiento de paciente', 'calentamiento', 'Pruebas de temperatura de salida y alarmas', 'funcionamiento', true),
  ('pruebas_incubadora', 'Pruebas · Incubadora / cuna radiante', 'incubadora', 'Pruebas de temperatura, humedad y alarmas', 'funcionamiento', true),
  ('pruebas_antropometria', 'Pruebas · Antropometría / esfigmo', 'antropometria', 'Pruebas de medición y precisión', 'funcionamiento', true),
  ('pruebas_electrocirugia', 'Pruebas · Electrocirugía', 'electrocirugia', 'Pruebas de potencia, alarma y placa paciente', 'funcionamiento', true)
on conflict (code) do update set
  name = excluded.name,
  equipment_kind = excluded.equipment_kind,
  description = excluded.description,
  list_kind = excluded.list_kind,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 3) Puntos de verificación (solo inserta faltantes)
-- ---------------------------------------------------------------------------
with pts(code, sort_order, label) as (
  values
    -- general (completar)
    ('general', 1, 'Carcasa / gabinete exterior'),
    ('general', 2, 'Pantalla / display'),
    ('general', 3, 'Botones / controles'),
    ('general', 4, 'Cable de alimentación'),
    ('general', 5, 'Conectores / puertos'),
    ('general', 6, 'Accesorios incluidos'),
    ('general', 7, 'Etiquetas / identificación'),
    ('general', 8, 'Limpieza general'),
    ('general', 9, 'Encendido / arranque'),
    ('general', 10, 'Alarmas audibles / visuales'),

    -- fetal
    ('fetal', 1, 'Estado físico de carcasa y pantalla'),
    ('fetal', 2, 'Estado físico de cable de alimentación'),
    ('fetal', 3, 'Estado físico de transductores US / TOCO'),
    ('fetal', 4, 'Estado físico de cinturones y gel'),
    ('fetal', 5, 'Estado físico de cable de paciente / eventos'),
    ('fetal', 6, 'Funcionamiento de botones e impresora'),
    ('fetal', 7, 'Alarmas audibles y visuales'),
    ('fetal', 8, 'Batería / respaldo'),
    ('fetal', 9, 'Limpieza de superficies clínicas'),

    -- ventilador
    ('ventilador', 1, 'Estado físico de carcasa y ruedas'),
    ('ventilador', 2, 'Estado físico de cable de alimentación'),
    ('ventilador', 3, 'Estado físico de circuito paciente'),
    ('ventilador', 4, 'Estado físico de sensores de flujo / presión'),
    ('ventilador', 5, 'Estado físico de humidificador / cámara'),
    ('ventilador', 6, 'Estado físico de filtros y válvulas'),
    ('ventilador', 7, 'Pantalla, menús y botonería'),
    ('ventilador', 8, 'Modos ventilatorios disponibles'),
    ('ventilador', 9, 'Alarmas de presión / volumen / apnea'),
    ('ventilador', 10, 'Batería de respaldo'),
    ('ventilador', 11, 'Prueba de fugas en circuito'),
    ('ventilador', 12, 'Conexiones de gas O2 / aire'),

    -- desfibrilador
    ('desfibrilador', 1, 'Estado físico de carcasa y controles'),
    ('desfibrilador', 2, 'Estado físico de paletas / pads'),
    ('desfibrilador', 3, 'Estado físico de cables ECG'),
    ('desfibrilador', 4, 'Estado físico de cable de alimentación'),
    ('desfibrilador', 5, 'Estado físico de batería'),
    ('desfibrilador', 6, 'Estado físico de impresora térmica'),
    ('desfibrilador', 7, 'Prueba de auto-test / self-test'),
    ('desfibrilador', 8, 'Funcionamiento de carga / descarga de prueba'),
    ('desfibrilador', 9, 'Alarmas y tonos'),
    ('desfibrilador', 10, 'Accesorios de emergencia incluidos'),

    -- bomba
    ('bomba_infusion', 1, 'Estado físico de carcasa y display'),
    ('bomba_infusion', 2, 'Estado físico de mecanismo de bombeo'),
    ('bomba_infusion', 3, 'Sensores de oclusión'),
    ('bomba_infusion', 4, 'Detector de aire'),
    ('bomba_infusion', 5, 'Estado físico de batería'),
    ('bomba_infusion', 6, 'Soportes / clamp / riel'),
    ('bomba_infusion', 7, 'Alarmas audibles y visuales'),
    ('bomba_infusion', 8, 'Cable de alimentación / docking'),
    ('bomba_infusion', 9, 'Limpieza y etiquetas'),

    -- autoclave
    ('autoclave', 1, 'Estado físico de puerta y empaque'),
    ('autoclave', 2, 'Estado físico de cámara interior'),
    ('autoclave', 3, 'Manómetros / sensores'),
    ('autoclave', 4, 'Ciclos de esterilización disponibles'),
    ('autoclave', 5, 'Filtros / drenaje / cassettes'),
    ('autoclave', 6, 'Alarmas de seguridad'),
    ('autoclave', 7, 'Impresora / registro de ciclo'),
    ('autoclave', 8, 'Indicadores químicos / biológicos (si aplica)'),
    ('autoclave', 9, 'Fugas / integridad del sistema'),

    -- ecg
    ('ecg', 1, 'Estado físico de carcasa y pantalla'),
    ('ecg', 2, 'Estado físico de impresora / papel'),
    ('ecg', 3, 'Estado físico de cables de paciente'),
    ('ecg', 4, 'Electrodos / pinzas / módulo de adquisición'),
    ('ecg', 5, 'Cable de alimentación / batería'),
    ('ecg', 6, 'Filtros, ganancia y velocidad'),
    ('ecg', 7, 'Memoria / exportación / conectividad'),
    ('ecg', 8, 'Limpieza general'),

    -- imagen
    ('imagen', 1, 'Consola / panel'),
    ('imagen', 2, 'Monitor de visualización'),
    ('imagen', 3, 'Transductor / tubo / detector'),
    ('imagen', 4, 'Cables y conectores'),
    ('imagen', 5, 'Calibración / geometría'),
    ('imagen', 6, 'Colimación / protecciones'),
    ('imagen', 7, 'Alarmas de seguridad'),
    ('imagen', 8, 'Limpieza de superficies clínicas'),

    -- cama hospitalaria genérica
    ('cama_hospitalaria', 1, 'Estado físico general del chasis'),
    ('cama_hospitalaria', 2, 'Estado físico de cable de alimentación'),
    ('cama_hospitalaria', 3, 'Estado físico de botoneras e indicadores'),
    ('cama_hospitalaria', 4, 'Estado físico de ruedas y bumpers'),
    ('cama_hospitalaria', 5, 'Estado físico de colchón'),
    ('cama_hospitalaria', 6, 'Estado físico de barandales'),
    ('cama_hospitalaria', 7, 'Estado físico de portasuero / accesorios'),
    ('cama_hospitalaria', 8, 'Freno / neutral / dirección'),
    ('cama_hospitalaria', 9, 'Elevación / descenso / Trendelenburg'),
    ('cama_hospitalaria', 10, 'Función de CPR'),
    ('cama_hospitalaria', 11, 'Batería / respaldo (si aplica)'),

    -- mesa quirúrgica
    ('mesa_quirurgica', 1, 'Estado físico de mesa y base'),
    ('mesa_quirurgica', 2, 'Estado físico de controles y pedales'),
    ('mesa_quirurgica', 3, 'Estado físico de ruedas y frenos'),
    ('mesa_quirurgica', 4, 'Estado físico de accesorios / rieles'),
    ('mesa_quirurgica', 5, 'Cable de alimentación / batería'),
    ('mesa_quirurgica', 6, 'Movimientos: altura, Trendelenburg, lateral'),
    ('mesa_quirurgica', 7, 'Bloqueo de posiciones'),
    ('mesa_quirurgica', 8, 'Limpieza y etiquetas'),

    -- lámpara
    ('lampara', 1, 'Estado físico de cabezal y brazos'),
    ('lampara', 2, 'Estado físico de manijas / esterilizables'),
    ('lampara', 3, 'Estado físico de suspensión / techo / pedestal'),
    ('lampara', 4, 'Cableado / conectores'),
    ('lampara', 5, 'Controles de intensidad y enfoque'),
    ('lampara', 6, 'Iluminación homogénea sin parpadeo'),
    ('lampara', 7, 'Respaldo / batería (si aplica)'),
    ('lampara', 8, 'Limpieza de superficies ópticas'),

    -- alto flujo
    ('alto_flujo', 1, 'Estado físico de unidad y torre'),
    ('alto_flujo', 2, 'Estado físico de cable de alimentación'),
    ('alto_flujo', 3, 'Estado físico de cámara / humidificador'),
    ('alto_flujo', 4, 'Estado físico de circuitos y conexiones O2'),
    ('alto_flujo', 5, 'Filtros / entrada de aire'),
    ('alto_flujo', 6, 'Pantalla y controles'),
    ('alto_flujo', 7, 'Alarmas audibles y visuales'),
    ('alto_flujo', 8, 'Limpieza general'),

    -- calentamiento
    ('calentamiento', 1, 'Estado físico de unidad de calentamiento'),
    ('calentamiento', 2, 'Estado físico de manguera / hose'),
    ('calentamiento', 3, 'Estado físico de cart / soporte'),
    ('calentamiento', 4, 'Cable de alimentación'),
    ('calentamiento', 5, 'Filtros de aire'),
    ('calentamiento', 6, 'Controles y display de temperatura'),
    ('calentamiento', 7, 'Alarmas de oclusión / sobretemperatura'),
    ('calentamiento', 8, 'Limpieza general'),

    -- incubadora
    ('incubadora', 1, 'Estado físico de campana / chasis'),
    ('incubadora', 2, 'Estado físico de puertas, puertos y sellos'),
    ('incubadora', 3, 'Estado físico de colchón / cuna'),
    ('incubadora', 4, 'Cable de alimentación'),
    ('incubadora', 5, 'Sensores de temperatura / humedad'),
    ('incubadora', 6, 'Controles y display'),
    ('incubadora', 7, 'Alarmas de temperatura / falla'),
    ('incubadora', 8, 'Fuente radiante / modo híbrido (si aplica)'),
    ('incubadora', 9, 'Limpieza y desinfección de superficies'),

    -- antropometría
    ('antropometria', 1, 'Estado físico de carcasa / plataforma'),
    ('antropometria', 2, 'Estado físico de display / manómetro'),
    ('antropometria', 3, 'Brazalete / manguera (si aplica)'),
    ('antropometria', 4, 'Cable de alimentación / batería'),
    ('antropometria', 5, 'Nivelación / estabilidad'),
    ('antropometria', 6, 'Etiquetas y calibración vigente'),
    ('antropometria', 7, 'Limpieza general'),

    -- electrocirugía
    ('electrocirugia', 1, 'Estado físico de generador y carcasa'),
    ('electrocirugia', 2, 'Estado físico de pedales'),
    ('electrocirugia', 3, 'Estado físico de cables / porta-electrodos'),
    ('electrocirugia', 4, 'Placa paciente / retorno'),
    ('electrocirugia', 5, 'Cable de alimentación'),
    ('electrocirugia', 6, 'Controles y display de potencia'),
    ('electrocirugia', 7, 'Alarmas de seguridad'),
    ('electrocirugia', 8, 'Limpieza general')
)
insert into public.service_checklist_template_points (template_id, label, sort_order)
select t.id, pts.label, pts.sort_order
from pts
join public.service_checklist_templates t on t.code = pts.code
where not exists (
  select 1
  from public.service_checklist_template_points existing
  where existing.template_id = t.id
    and existing.label = pts.label
);

-- ---------------------------------------------------------------------------
-- 4) Puntos de funcionamiento (con intervalos cuando aplica)
-- ---------------------------------------------------------------------------
with pts(
  code, sort_order, label, unit, min_value, max_value
) as (
  values
    -- general
    ('pruebas_funcionamiento_general', 1, 'Encendido / arranque del equipo', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 2, 'Autodiagnóstico / POST', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 3, 'Alarmas audibles y visuales', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 4, 'Funciones principales del equipo', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 5, 'Precisión / desempeño observado', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 6, 'Interfaces / conectividad', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 7, 'Accesorios y periféricos', '', null::numeric, null::numeric),
    ('pruebas_funcionamiento_general', 8, 'Cierre / apagado seguro', '', null::numeric, null::numeric),

    -- monitor (si faltan; las existentes se respetan)
    ('pruebas_monitor_de_signos_vitales', 1, 'Frecuencia Cardiaca 60 lpm', 'lpm', 57::numeric, 63::numeric),
    ('pruebas_monitor_de_signos_vitales', 2, 'Frecuencia Respiratoria 20 rpm', 'rpm', 14::numeric, 20::numeric),
    ('pruebas_monitor_de_signos_vitales', 3, 'Saturación de oxígeno (SpO2) 97% O2 Sat.', '%', 94::numeric, 100::numeric),
    ('pruebas_monitor_de_signos_vitales', 4, 'Presión Arterial No Invasivas (NIBP) Sistólica 120', 'mmHg', 94::numeric, 131::numeric),
    ('pruebas_monitor_de_signos_vitales', 5, 'Presión Arterial No Invasivas (NIBP) Diastólica 80', 'mmHg', 77::numeric, 83::numeric),
    ('pruebas_monitor_de_signos_vitales', 6, 'Temperatura 37.0 °C', '°C', 36.7::numeric, 37.3::numeric),
    ('pruebas_monitor_de_signos_vitales', 7, 'Alarmas y límites configurables', '', null::numeric, null::numeric),

    -- fetal
    ('pruebas_fetal', 1, 'Detección FCF con transductor US', 'lpm', 110::numeric, 160::numeric),
    ('pruebas_fetal', 2, 'Señal TOCO / contracciones', '', null::numeric, null::numeric),
    ('pruebas_fetal', 3, 'Impresión / registro de trazo', '', null::numeric, null::numeric),
    ('pruebas_fetal', 4, 'Alarmas de bradicardia / taquicardia', '', null::numeric, null::numeric),
    ('pruebas_fetal', 5, 'Eventos de paciente / marcadores', '', null::numeric, null::numeric),
    ('pruebas_fetal', 6, 'Autotest / encendido correcto', '', null::numeric, null::numeric),

    -- ventilador
    ('pruebas_ventilador', 1, 'Volumen tidal 500 ml', 'ml', 475::numeric, 525::numeric),
    ('pruebas_ventilador', 2, 'Frecuencia 12 rpm', 'rpm', 11::numeric, 13::numeric),
    ('pruebas_ventilador', 3, 'PEEP 5 cmH2O', 'cmH2O', 4::numeric, 6::numeric),
    ('pruebas_ventilador', 4, 'FiO2 21%', '%', 20::numeric, 23::numeric),
    ('pruebas_ventilador', 5, 'FiO2 100%', '%', 97::numeric, 100::numeric),
    ('pruebas_ventilador', 6, 'Presión pico de prueba', 'cmH2O', 18::numeric, 22::numeric),
    ('pruebas_ventilador', 7, 'Prueba de fugas / estanqueidad', '', null::numeric, null::numeric),
    ('pruebas_ventilador', 8, 'Alarmas de apnea / presión', '', null::numeric, null::numeric),
    ('pruebas_ventilador', 9, 'Autotest / calibración de sensores', '', null::numeric, null::numeric),

    -- vaporizador
    ('pruebas_vaporizador', 1, 'Identificación de agente correcta', '', null::numeric, null::numeric),
    ('pruebas_vaporizador', 2, 'Concentración seleccionada vs medida', '%', null::numeric, null::numeric),
    ('pruebas_vaporizador', 3, 'Prueba de fugas en montaje', '', null::numeric, null::numeric),
    ('pruebas_vaporizador', 4, 'Interlock operativo', '', null::numeric, null::numeric),
    ('pruebas_vaporizador', 5, 'Nivel de agente / sistema de llenado', '', null::numeric, null::numeric),

    -- desfibrilador
    ('pruebas_desfibrilador', 1, 'Energía 50 J', 'J', 45::numeric, 55::numeric),
    ('pruebas_desfibrilador', 2, 'Energía 100 J', 'J', 90::numeric, 110::numeric),
    ('pruebas_desfibrilador', 3, 'Energía 200 J', 'J', 180::numeric, 220::numeric),
    ('pruebas_desfibrilador', 4, 'Tiempo de carga a 200 J', 's', 0::numeric, 15::numeric),
    ('pruebas_desfibrilador', 5, 'Auto-test / self-test OK', '', null::numeric, null::numeric),
    ('pruebas_desfibrilador', 6, 'Monitoreo ECG / trazado', '', null::numeric, null::numeric),
    ('pruebas_desfibrilador', 7, 'Impresora operativa', '', null::numeric, null::numeric),

    -- bomba
    ('pruebas_bomba_infusion', 1, 'Flujo 50 ml/h', 'ml/h', 47.5::numeric, 52.5::numeric),
    ('pruebas_bomba_infusion', 2, 'Flujo 100 ml/h', 'ml/h', 95::numeric, 105::numeric),
    ('pruebas_bomba_infusion', 3, 'Flujo 200 ml/h', 'ml/h', 190::numeric, 210::numeric),
    ('pruebas_bomba_infusion', 4, 'Alarma de oclusión', '', null::numeric, null::numeric),
    ('pruebas_bomba_infusion', 5, 'Detector de aire', '', null::numeric, null::numeric),
    ('pruebas_bomba_infusion', 6, 'Autonomía de batería observada', '', null::numeric, null::numeric),

    -- autoclave
    ('pruebas_autoclave', 1, 'Ciclo de prueba completado', '', null::numeric, null::numeric),
    ('pruebas_autoclave', 2, 'Temperatura de ciclo (si aplica)', '°C', null::numeric, null::numeric),
    ('pruebas_autoclave', 3, 'Registro / impresión de ciclo', '', null::numeric, null::numeric),
    ('pruebas_autoclave', 4, 'Indicador químico / biológico OK', '', null::numeric, null::numeric),
    ('pruebas_autoclave', 5, 'Alarmas de puerta / falla', '', null::numeric, null::numeric),

    -- ecg
    ('pruebas_ecg', 1, 'Calibración 1 mV = 10 mm', 'mm', 9.5::numeric, 10.5::numeric),
    ('pruebas_ecg', 2, 'Velocidad de papel 25 mm/s', 'mm/s', 24::numeric, 26::numeric),
    ('pruebas_ecg', 3, 'Calidad de trazo / ruido', '', null::numeric, null::numeric),
    ('pruebas_ecg', 4, 'Filtros y derivaciones', '', null::numeric, null::numeric),
    ('pruebas_ecg', 5, 'Impresión / exportación', '', null::numeric, null::numeric),

    -- imagen
    ('pruebas_imagen', 1, 'Encendido y autotest', '', null::numeric, null::numeric),
    ('pruebas_imagen', 2, 'Calidad de imagen de referencia', '', null::numeric, null::numeric),
    ('pruebas_imagen', 3, 'Controles de exposición / ganancia', '', null::numeric, null::numeric),
    ('pruebas_imagen', 4, 'Alarmas de seguridad', '', null::numeric, null::numeric),
    ('pruebas_imagen', 5, 'Almacenamiento / impresión', '', null::numeric, null::numeric),

    -- cama genérica
    ('pruebas_cama_hospitalaria', 1, 'Freno / neutral / dirección', '', null::numeric, null::numeric),
    ('pruebas_cama_hospitalaria', 2, 'Elevación / descenso', '', null::numeric, null::numeric),
    ('pruebas_cama_hospitalaria', 3, 'Trendelenburg / posiciones', '', null::numeric, null::numeric),
    ('pruebas_cama_hospitalaria', 4, 'Barandales y seguros', '', null::numeric, null::numeric),
    ('pruebas_cama_hospitalaria', 5, 'Función CPR', '', null::numeric, null::numeric),
    ('pruebas_cama_hospitalaria', 6, 'Botoneras / bloqueo de controles', '', null::numeric, null::numeric),

    -- affinity functioning
    ('pruebas_cama_parto_affinity_4', 1, 'Freno / neutral / dirección', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 2, 'Elevación / descenso', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 3, 'Elevación de cabecera', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 4, 'Elevación / descenso de pies', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 5, 'Trendelenburg 8°', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 6, 'Sección de pies con retirada por deslizamiento', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 7, 'Barandales y seguros EasyGlide / OneStep', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 8, 'Función CPR', '', null::numeric, null::numeric),
    ('pruebas_cama_parto_affinity_4', 9, 'Batería / respaldo', '', null::numeric, null::numeric),

    -- camilla 8040 functioning
    ('pruebas_camilla_8040', 1, 'Freno / neutral / dirección', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 2, 'Elevación / descenso', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 3, 'Trendelenburg / Trendelenburg inverso', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 4, 'Pistones de gas de cabecera', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 5, 'Barandales', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 6, 'Función CPR', '', null::numeric, null::numeric),
    ('pruebas_camilla_8040', 7, 'Control externo cableado (si aplica)', '', null::numeric, null::numeric),

    -- mesa
    ('pruebas_mesa_quirurgica', 1, 'Altura de mesa', '', null::numeric, null::numeric),
    ('pruebas_mesa_quirurgica', 2, 'Trendelenburg / anti-Trendelenburg', '', null::numeric, null::numeric),
    ('pruebas_mesa_quirurgica', 3, 'Inclinación lateral', '', null::numeric, null::numeric),
    ('pruebas_mesa_quirurgica', 4, 'Frenos / bloqueo', '', null::numeric, null::numeric),
    ('pruebas_mesa_quirurgica', 5, 'Controles / pedales', '', null::numeric, null::numeric),

    -- lámpara
    ('pruebas_lampara', 1, 'Intensidad mínima / máxima', '', null::numeric, null::numeric),
    ('pruebas_lampara', 2, 'Enfoque / campo luminoso', '', null::numeric, null::numeric),
    ('pruebas_lampara', 3, 'Movimiento de brazos sin deriva', '', null::numeric, null::numeric),
    ('pruebas_lampara', 4, 'Respaldo / batería (si aplica)', '', null::numeric, null::numeric),
    ('pruebas_lampara', 5, 'Sin parpadeo / ruido anormal', '', null::numeric, null::numeric),

    -- alto flujo
    ('pruebas_alto_flujo', 1, 'Flujo de prueba (adulto)', 'L/min', 20::numeric, 60::numeric),
    ('pruebas_alto_flujo', 2, 'Temperatura de salida', '°C', 31::numeric, 37::numeric),
    ('pruebas_alto_flujo', 3, 'Humedad / cámara operativa', '', null::numeric, null::numeric),
    ('pruebas_alto_flujo', 4, 'Alarmas de desconexión / agua', '', null::numeric, null::numeric),
    ('pruebas_alto_flujo', 5, 'Suministro de O2 estable', '', null::numeric, null::numeric),

    -- calentamiento
    ('pruebas_calentamiento', 1, 'Temperatura de salida baja', '°C', 32::numeric, 38::numeric),
    ('pruebas_calentamiento', 2, 'Temperatura de salida alta', '°C', 40::numeric, 46::numeric),
    ('pruebas_calentamiento', 3, 'Alarma de manguera / oclusión', '', null::numeric, null::numeric),
    ('pruebas_calentamiento', 4, 'Alarma de sobretemperatura', '', null::numeric, null::numeric),
    ('pruebas_calentamiento', 5, 'Flujo de aire continuo', '', null::numeric, null::numeric),

    -- incubadora
    ('pruebas_incubadora', 1, 'Temperatura de aire / piel', '°C', 36.0::numeric, 37.5::numeric),
    ('pruebas_incubadora', 2, 'Humedad (si aplica)', '%', 40::numeric, 80::numeric),
    ('pruebas_incubadora', 3, 'Alarmas de temperatura', '', null::numeric, null::numeric),
    ('pruebas_incubadora', 4, 'Modo radiante / híbrido (si aplica)', '', null::numeric, null::numeric),
    ('pruebas_incubadora', 5, 'Estabilidad térmica observada', '', null::numeric, null::numeric),

    -- antropometría
    ('pruebas_antropometria', 1, 'Lectura con peso patrón / referencia', '', null::numeric, null::numeric),
    ('pruebas_antropometria', 2, 'Presión de referencia (esfigmo)', 'mmHg', null::numeric, null::numeric),
    ('pruebas_antropometria', 3, 'Cero / tara', '', null::numeric, null::numeric),
    ('pruebas_antropometria', 4, 'Repetibilidad de medición', '', null::numeric, null::numeric),

    -- electrocirugía
    ('pruebas_electrocirugia', 1, 'Potencia de corte de prueba', 'W', null::numeric, null::numeric),
    ('pruebas_electrocirugia', 2, 'Potencia de coagulación de prueba', 'W', null::numeric, null::numeric),
    ('pruebas_electrocirugia', 3, 'Alarma de placa paciente', '', null::numeric, null::numeric),
    ('pruebas_electrocirugia', 4, 'Pedales / activación', '', null::numeric, null::numeric),
    ('pruebas_electrocirugia', 5, 'Autotest / encendido correcto', '', null::numeric, null::numeric)
)
insert into public.service_checklist_template_points (
  template_id, label, sort_order, unit, min_value, max_value
)
select t.id, pts.label, pts.sort_order, pts.unit, pts.min_value, pts.max_value
from pts
join public.service_checklist_templates t on t.code = pts.code
where not exists (
  select 1
  from public.service_checklist_template_points existing
  where existing.template_id = t.id
    and existing.label = pts.label
);

-- ---------------------------------------------------------------------------
-- 5) Reclasificar equipos de cliente con heurística ampliada
-- ---------------------------------------------------------------------------
update public.client_equipment
set equipment_kind = case
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'anestesi|atlan|fabius' then 'anestesia'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'vaporiz|vapor|d-vapor|scio' then 'vaporizador'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'fetal|avalon|fm20|fm30' then 'fetal'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'desfibr|dea|dfm100' then 'desfibrilador'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'bomba|infus|perfusor|infusomat' then 'bomba_infusion'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'incub|cuna radiante|baby.?leo|tn500' then 'incubadora'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'airvo|alto.?flujo|humidific|mr850' then 'alto_flujo'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'bair.?hugger|calentamient|warming' then 'calentamiento'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'polaris|l[aá]mpara' then 'lampara'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'mesa.*(cirug|quir)|pst.?500' then 'mesa_quirurgica'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'cama|camilla|affinity|centuris|progressa|accella|p8040|p8000' then 'cama'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'electrocirug|electrobistur|bistur' then 'electrocirugia'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'ventil|respir|evita|babylog' then 'ventilador'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'monitor|multipar|spo2|ox[ií]metr|radical|rad-g|mightysat|sedline|root|connex|vista|intellivue|mx550|mx100|m540|emma|tofscan|invivo|bis' then 'monitor'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'autocl|esteril|sterrad' then 'autoclave'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'ecg|electrocard|cardioperfect|eli.?280|eli.?150' then 'ecg'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'esfigmo|b[aá]scula|antropometr|seca|7670|ds44' then 'antropometria'
  when lower(coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))
    ~ 'rayos|ultrason|imagen' then 'imagen'
  else equipment_kind
end
where coalesce(equipment_kind, '') in ('', 'general', 'ventilador', 'monitor');

notify pgrst, 'reload schema';
