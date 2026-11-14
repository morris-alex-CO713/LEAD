import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { BusinessListing } from '../types';
import LeadCard from './LeadCard';

interface KanbanBoardProps {
  listings: BusinessListing[];
  onDragEnd: (result: DropResult) => void;
  onLeadClick: (lead: BusinessListing) => void;
}

const COLUMNS = [
  { id: 'new', label: 'New', color: 'bg-primary', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-500', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]' },
  { id: 'qualified', label: 'Qualified', color: 'bg-emerald-500', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' },
  { id: 'closed', label: 'Closed', color: 'bg-blue-500', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]' },
] as const;

const KanbanBoard: React.FC<KanbanBoardProps> = ({ listings, onDragEnd, onLeadClick }) => {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex gap-4 min-w-[900px] lg:grid lg:grid-cols-4 lg:gap-6 pb-10 min-h-[600px]">
          {COLUMNS.map(col => {
            const colListings = listings.filter(l => l.status === col.id);
            return (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex flex-col bg-secondary/20 rounded-md p-4 min-h-[500px] border transition-colors ${
                      snapshot.isDraggingOver ? 'bg-primary/5 border-primary/20' : 'border-border/30'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-5 px-1">
                      <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${col.color} ${col.glow}`} />
                        {col.label}
                      </h4>
                      <span className="text-[9px] font-black text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded border border-border/50">
                        {colListings.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-3 flex-1">
                      {colListings.map((biz, index) => (
                        <React.Fragment key={biz.id}>
                          <Draggable draggableId={biz.id} index={index}>
                            {(provided, snapshot) => (
                              <LeadCard
                                listing={biz}
                                onClick={() => onLeadClick(biz)}
                                draggableProps={provided.draggableProps}
                                dragHandleProps={provided.dragHandleProps}
                                innerRef={provided.innerRef}
                                isDragging={snapshot.isDragging}
                                isKanban={true}
                              />
                            )}
                          </Draggable>
                        </React.Fragment>
                      ))}
                      {provided.placeholder}

                      {colListings.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/30 rounded-md min-h-[120px]">
                          <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">Drop here</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
