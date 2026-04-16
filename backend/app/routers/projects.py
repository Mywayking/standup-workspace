from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, Project
from ..schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    result = []
    for p in projects:
        result.append(ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description or "",
            created_at=p.created_at,
            updated_at=p.updated_at,
            script_count=len(p.scripts),
        ))
    return result


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    p = Project(name=data.name, description=data.description or "")
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description or "",
        created_at=p.created_at,
        updated_at=p.updated_at,
        script_count=0,
    )


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if data.name is not None:
        p.name = data.name
    if data.description is not None:
        p.description = data.description
    db.commit()
    db.refresh(p)
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description or "",
        created_at=p.created_at,
        updated_at=p.updated_at,
        script_count=len(p.scripts),
    )


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    db.delete(p)
    db.commit()
