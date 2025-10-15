import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { setDayAvailability } from "../service/Api-reservations";

export default function TutorAvailabilityPage() {
  const auth = useAuth();
  const idToken = auth.user?.access_token ?? "";
  const tutorSub = auth.user?.profile?.sub ?? ""; // sub desde el token
  const [day, setDay] = useState<string>(require('dayjs')().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState<Array<{start:string; end:string}>>([]);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const toHHmm = (t:string) => (t && t.length>=5) ? t.slice(0,5) : "00:00";


  const addSlot = () => {
    setSlots(prev => [...prev, {start:toHHmm(newStart), end:toHHmm(newEnd)}]);
  };

  const save = async () => {
    if (!tutorSub) return alert("No se pudo leer tu sub del token");
    try {
      await setDayAvailability(tutorSub, day, slots, idToken);
      alert("Disponibilidad guardada");
      setSlots([]);
    } catch (e:any) {
      alert(e.message || "Error guardando disponibilidad");
    }
  };

  return (
    <div>
      <h2>Disponibilidad del Tutor</h2>
      <p><b>Mi sub:</b> {tutorSub || "(no auth)"}</p>

      <div>
        <label>Día: </label>
        <input type="date" value={day} onChange={e => setDay(e.target.value)} />
      </div>

      <div>
        <label>Inicio: </label>
        <input type="time" step="3600" value={newStart} onChange={e => setNewStart(e.target.value)} />
        <label>Fin: </label>
        <input type="time" step="3600" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
        <button onClick={addSlot}>Agregar</button>
      </div>

      <ul>
        {slots.map((s, i) => <li key={i}>{s.start} - {s.end}</li>)}
      </ul>

      <button onClick={save} disabled={!auth.user}>Guardar disponibilidad</button>
    </div>
  );
}
