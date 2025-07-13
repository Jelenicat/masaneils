// VerticalScheduleView.js
import React from "react";
import EventModal from "./EventModal"; // Pretpostavljeni modal
import "../styles/VerticalScheduleView.css"; // Ako koristiš custom stilove

const VerticalScheduleView = ({
  events,
  selectedWeekStart,
  onSelectSlot,
  onSelectEvent,
  showModal,
  setShowModal,
  newEventData,
  setNewEventData,
  isEditing,
  setIsEditing,
  korisnice,
  handleSaveEvent,
  handleDeleteEvent,
  handleSendSuggestion,
  isLoading,
  izboriPoTerminu,
  potvrdiTerminZaKorisnicu,
}) => {
  return (
    <div className="vertical-schedule-view">
      {/* Prikaz događaja po danima */}
      <div className="day-columns">
        {Array.from({ length: 6 }).map((_, dayIndex) => {
          const dayDate = new Date(
            selectedWeekStart.getFullYear(),
            selectedWeekStart.getMonth(),
            selectedWeekStart.getDate() + dayIndex
          );

          const dayEvents = events.filter((event) => {
            const eventDate = new Date(event.start);
            return (
              eventDate.getDate() === dayDate.getDate() &&
              eventDate.getMonth() === dayDate.getMonth() &&
              eventDate.getFullYear() === dayDate.getFullYear()
            );
          });

          return (
            <div key={dayIndex} className="day-column">
              <div className="day-header">
                {dayDate.toLocaleDateString("sr-RS", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
              <div className="day-events">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="event-card"
                    style={{ backgroundColor: event.backgroundColor }}
                    onClick={() => onSelectEvent(event)}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
              <div
                className="add-slot-button"
                onClick={() => {
                  const start = new Date(dayDate);
                  start.setHours(9, 0, 0, 0);
                  const end = new Date(start);
                  end.setHours(10, 0, 0, 0);
                  onSelectSlot({ start, end });
                }}
              >
                + Dodaj termin
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal za dodavanje/izmenu termina */}
      {showModal && (
        <EventModal
          showModal={showModal}
          setShowModal={setShowModal}
          eventData={newEventData}
          setEventData={setNewEventData}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          korisnice={korisnice}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={handleDeleteEvent}
          handleSendSuggestion={handleSendSuggestion}
          isLoading={isLoading}
          izboriPoTerminu={izboriPoTerminu}
          potvrdiTerminZaKorisnicu={potvrdiTerminZaKorisnicu}
        />
      )}
    </div>
  );
};

export default VerticalScheduleView;