-- Completa puntos de verificación faltantes en el seed (monitor, anestesia,
-- vaporizador, Affinity 4, camilla 8040). Solo inserta etiquetas nuevas.

with pts(code, sort_order, label) as (
  values
    -- monitor
    ('monitor_de_signos_vitales', 1, 'Estado físico cable troncal multimed'),
    ('monitor_de_signos_vitales', 2, 'Estado físico cable troncal SPo2'),
    ('monitor_de_signos_vitales', 3, 'Estado físico cable sensor SPo2'),
    ('monitor_de_signos_vitales', 4, 'Estado físico manguera PANI'),
    ('monitor_de_signos_vitales', 5, 'Estado físico brazalete PANI'),
    ('monitor_de_signos_vitales', 6, 'Estado físico sensor Temp'),
    ('monitor_de_signos_vitales', 7, 'Estado físico cable troncal ECG'),
    ('monitor_de_signos_vitales', 8, 'Estado físico Latiguillos ECG'),
    ('monitor_de_signos_vitales', 9, 'Estado físico cable de alimentación'),
    ('monitor_de_signos_vitales', 10, 'Funcionamiento botonería y man giratorio'),
    ('monitor_de_signos_vitales', 11, 'Funcionamiento alarmas visibles y audibles'),
    ('monitor_de_signos_vitales', 12, 'Funcionamiento batería'),
    ('monitor_de_signos_vitales', 13, 'Estado físico cable Presión Invasiva'),
    ('monitor_de_signos_vitales', 14, 'Estado físico cable sensor capnografía'),
    ('monitor_de_signos_vitales', 15, 'Funcionamiento Índice Bioespectral'),
    ('monitor_de_signos_vitales', 16, 'Estado físico cable gasto cardiaco'),

    -- anestesia
    ('maquina_de_anestesia', 1, 'Estado físico general del chasis'),
    ('maquina_de_anestesia', 2, 'Estado físico de frenos y ruedas'),
    ('maquina_de_anestesia', 3, 'Estado físico del cable de alimentación'),
    ('maquina_de_anestesia', 4, 'Estado físico de controles, indicadores, etiquetas y contacto'),
    ('maquina_de_anestesia', 5, 'Estado físico de vaporizadores'),
    ('maquina_de_anestesia', 6, 'Estado físico de canister y cal sodada'),
    ('maquina_de_anestesia', 7, 'Estado físico de mangueras de gas y tomas'),
    ('maquina_de_anestesia', 8, 'Estado físico de entradas y conectores de gases'),
    ('maquina_de_anestesia', 9, 'Estado físico de sistema COSY'),
    ('maquina_de_anestesia', 10, 'Estado físico de trama de agua de analizador de gases'),
    ('maquina_de_anestesia', 11, 'Estado físico de circuito respiratorio (General)'),
    ('maquina_de_anestesia', 12, 'Funcionamiento de botones'),
    ('maquina_de_anestesia', 13, 'Presión suministro central de aire'),
    ('maquina_de_anestesia', 14, 'Presión suministro central de oxígeno'),
    ('maquina_de_anestesia', 15, 'Chequeo de sensores'),
    ('maquina_de_anestesia', 16, 'Pistón del ventilador'),
    ('maquina_de_anestesia', 17, 'Sistema respiratorio'),
    ('maquina_de_anestesia', 18, 'Válvulas/ventilador'),
    ('maquina_de_anestesia', 19, 'Sistema de evacuación de gases (AGS)'),
    ('maquina_de_anestesia', 20, 'Válvula APL'),
    ('maquina_de_anestesia', 21, 'Fuga (del sistema)'),
    ('maquina_de_anestesia', 22, 'Fuga (manual espontáneo)'),
    ('maquina_de_anestesia', 23, 'Compliancia (sistema)'),
    ('maquina_de_anestesia', 24, 'Alarmas, Altavoz'),
    ('maquina_de_anestesia', 25, 'Analizador de gas'),
    ('maquina_de_anestesia', 26, 'Sensor de oxígeno'),
    ('maquina_de_anestesia', 27, 'Alimentación eléctrica'),
    ('maquina_de_anestesia', 28, 'Batería'),

    -- vaporizador
    ('vaporizador', 1, 'Inspección física general del vaporizador'),
    ('vaporizador', 2, 'Verificar identificación y agente anestésico'),
    ('vaporizador', 3, 'Revisar perilla y escala de concentración'),
    ('vaporizador', 4, 'Verificar sistema de llenado y nivel de agente'),
    ('vaporizador', 5, 'Revisar conexiones, montaje y sellos'),
    ('vaporizador', 6, 'Verificar sistema de interlock'),
    ('vaporizador', 7, 'Realizar prueba de fugas'),
    ('vaporizador', 8, 'Limpieza'),

    -- Affinity 4
    ('cama_de_parto_affinity_4', 1, 'ESTADO FÍSICO GENERAL DEL CHASIS'),
    ('cama_de_parto_affinity_4', 2, 'ESTADO FÍSICO DEL CABLE DE ALIMENTACIÓN ELÉCTRICA'),
    ('cama_de_parto_affinity_4', 3, 'ESTADO FÍSICO DE LA BOTONERA, INDICADORES Y ETIQUETAS'),
    ('cama_de_parto_affinity_4', 4, 'ESTADO FÍSICO DE LAS RUEDAS'),
    ('cama_de_parto_affinity_4', 5, 'ESTADO FÍSICO DEL COLCHÓN'),
    ('cama_de_parto_affinity_4', 6, 'ESTADO FÍSICO DEL PANEL DE CABECERA'),
    ('cama_de_parto_affinity_4', 7, 'ESTADO FÍSICO DE LOS BARANDALES'),
    ('cama_de_parto_affinity_4', 8, 'ESTADO FÍSICO DEL PEDAL DE MOVILIDAD'),
    ('cama_de_parto_affinity_4', 9, 'ESTADO FÍSICO DEL GATILLO Y CHICOTES DE CPR'),
    ('cama_de_parto_affinity_4', 10, 'ESTADO FÍSICO DE REPOSA PANTORRILLAS EASYGLIDE™'),
    ('cama_de_parto_affinity_4', 11, 'ESTADO FÍSICO DE REPOSA PIÉS ONESTEP™'),
    ('cama_de_parto_affinity_4', 12, 'ESTADO FÍSICO DE ASAS DE TRABAJO DE PARTO'),
    ('cama_de_parto_affinity_4', 13, 'ESTADO FÍSICO DE LOS BUMPERS Y ASAS DE EMPUJE'),
    ('cama_de_parto_affinity_4', 14, 'ESTADO FÍSICO DEL PORTASUEROS, BANDEJA PARA LÍQUIDOS Y BARRA DE LABOR'),
    ('cama_de_parto_affinity_4', 15, 'FRENO'),
    ('cama_de_parto_affinity_4', 16, 'NEUTRAL'),
    ('cama_de_parto_affinity_4', 17, 'DIRECCIÓN'),
    ('cama_de_parto_affinity_4', 18, 'CONEXIÓN Y PRUEBAS DE FUNCIONAMIENTO DE LA BATERÍA'),
    ('cama_de_parto_affinity_4', 19, 'PRUEBA DE BOTONES DE POSICIÓN'),
    ('cama_de_parto_affinity_4', 20, 'PRUEBA DE BOTONES DE ELEVACIÓN/DESCENSO'),
    ('cama_de_parto_affinity_4', 21, 'PRUEBA DE BOTÓN (E INDICADOR) DE BLOQUEO DE CONTROLES'),
    ('cama_de_parto_affinity_4', 22, 'ELEVACIÓN/DESCENSO'),
    ('cama_de_parto_affinity_4', 23, 'ELEVACIÓN DE CABECERA'),
    ('cama_de_parto_affinity_4', 24, 'ELEVACIÓN/DESCENSO DE PIES'),
    ('cama_de_parto_affinity_4', 25, 'TRENDELENBURG DE 8°'),
    ('cama_de_parto_affinity_4', 26, 'PRUEBA DE SECCIÓN DE PIES CON RETIRADA POR DESLIZAMIENTO'),
    ('cama_de_parto_affinity_4', 27, 'FUNCIONAMIENTO DE LOS BARANDALES'),
    ('cama_de_parto_affinity_4', 28, 'FUNCIONAMIENTO DEL SEGURO DEL REPOSA PANTORRILLAS EASYGLIDE™'),
    ('cama_de_parto_affinity_4', 29, 'FUNCIONAMIENTO DEL SEGURO DE ASAS DE TRABAJO DE PARTO'),
    ('cama_de_parto_affinity_4', 30, 'FUNCIONAMIENTO DEL SEGURO DE ASAS DE EMPUJE'),
    ('cama_de_parto_affinity_4', 31, 'FUNCIÓN DE CPR'),

    -- Camilla 8040
    ('camilla_8040', 1, 'ESTADO FÍSICO GENERAL DEL CHASIS Y PORTA XRAY'),
    ('camilla_8040', 2, 'ESTADO FÍSICO DE  INDICADORES Y ETIQUETAS'),
    ('camilla_8040', 3, 'ESTADO FÍSICO DE LAS RUEDAS'),
    ('camilla_8040', 4, 'ESTADO FÍSICO DEL COLCHÓN'),
    ('camilla_8040', 5, 'ESTADO FÍSICO DE LOS BARANDALES'),
    ('camilla_8040', 6, 'ESTADO FÍSICO DE PEDALES'),
    ('camilla_8040', 7, 'ESTADO FÍSICO DE PISTONES DE GAS DE CABECERA'),
    ('camilla_8040', 8, 'ESTADO FÍSICO DE LOS BUMPERS'),
    ('camilla_8040', 9, 'ESTADO FÍSICO DEL PORTASUEROS'),
    ('camilla_8040', 10, 'FRENO'),
    ('camilla_8040', 11, 'NEUTRAL'),
    ('camilla_8040', 12, 'DIRECCIÓN'),
    ('camilla_8040', 13, 'PRUEBA DE POSICIÓN'),
    ('camilla_8040', 14, 'ELEVACIÓN/DESCENSO'),
    ('camilla_8040', 15, 'TRENDELENBURG/TRENDELENBURG INVERSO'),
    ('camilla_8040', 16, 'PRUEBA DE CONTROL EXTERNO CABLEADO*'),
    ('camilla_8040', 17, 'FUNCIONAMIENTO DE LOS BARANDALES'),
    ('camilla_8040', 18, 'FUNCIÓN DE CPR')
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

notify pgrst, 'reload schema';
